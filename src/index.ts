#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";

import { StateStorage, StateFile } from "./storage/index.js";
import { ASTIndexer, FileWatcher } from "./ast/index.js";
import { OllamaClient } from "./utils/ollama.js";
import {
  TOOL_DEFINITIONS,
  // Original handlers
  getCodebaseMap,
  searchSemantics,
  getDependencyGraph,
  commitDecision,
  fetchActiveDecisions,
  resumeSession,
  summarizeLongHistory,
  updateProjectState,
  // New feature handlers
  bootstrap,
  memorySearch,
  memoryStore,
  memoryAsk,
  verifyFact,
  getStaleFacts,
  validateCitations,
  getRelatedFacts,
  getAffectedFacts,
  exportContext,
  type ToolContext
} from "./tools/index.js";

const PROJECT_ROOT = process.env.CONTEXT_FORGE_ROOT || process.cwd();
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1:8b";

class ContextForgeServer {
  private server: Server;
  private storage: StateStorage;
  private stateFile: StateFile;
  private indexer: ASTIndexer;
  private watcher: FileWatcher;
  private ollamaClient: OllamaClient;
  private toolContext: ToolContext;

  constructor() {
    this.storage = new StateStorage(PROJECT_ROOT);
    this.stateFile = new StateFile(PROJECT_ROOT);
    this.indexer = new ASTIndexer(this.storage, PROJECT_ROOT);
    this.watcher = new FileWatcher(this.indexer, PROJECT_ROOT);
    this.ollamaClient = new OllamaClient({
      baseUrl: OLLAMA_URL,
      model: OLLAMA_MODEL
    });

    this.toolContext = {
      storage: this.storage,
      stateFile: this.stateFile,
      indexer: this.indexer,
      ollamaClient: this.ollamaClient,
      projectRoot: PROJECT_ROOT
    };

    this.server = new Server(
      {
        name: "context-forge",
        version: "1.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFINITIONS
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.handleToolCall(name, args || {});
        return {
          content: [
            {
              type: "text",
              text: result.content
            }
          ],
          isError: result.isError
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private async handleToolCall(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: string; isError?: boolean }> {
    switch (name) {
      // Feature 1: Bootstrap - Auto-load on session start
      case "bootstrap":
        return bootstrap(this.toolContext);
      
      case "get_codebase_map":
        return getCodebaseMap(this.toolContext, args.module_path as string);
      
      case "search_semantics":
        return searchSemantics(this.toolContext, args.query as string);
      
      // Feature 2: Memory search with tags filtering
      case "memory_search":
        return memorySearch(this.toolContext, {
          tags: args.tags as string[] | undefined,
          limit: args.limit as number | undefined,
          includeStale: args.include_stale as boolean | undefined,
          minPriority: args.min_priority as number | undefined
        });
      
      // Feature 2, 3, 5, 9: Memory store with tags, priority, citations, relations
      case "memory_store":
        return memoryStore(this.toolContext, {
          content: args.content as string,
          type: args.type as "fact" | "decision" | undefined,
          tags: args.tags as string[] | undefined,
          citations: args.citations as string[] | undefined,
          relatedTo: args.related_to as string[] | undefined,
          priority: args.priority as number | undefined,
          supersedesId: args.supersedes_id as string | undefined
        });
      
      // Feature 10: Natural language querying
      case "memory_ask":
        return memoryAsk(
          this.toolContext,
          args.question as string,
          args.limit as number | undefined
        );
      
      case "get_dependency_graph":
        return getDependencyGraph(this.toolContext, args.target as string);
      
      case "commit_decision":
        return commitDecision(
          this.toolContext,
          args.fact as string,
          {
            tags: args.tags as string[] | undefined,
            citations: args.citations as string[] | undefined,
            priority: args.priority as number | undefined,
            supersedesId: args.supersedes_id as string | undefined
          }
        );
      
      case "fetch_active_decisions":
        return fetchActiveDecisions(this.toolContext);
      
      case "resume_session":
        return resumeSession(this.toolContext);
      
      // Feature 3: Staleness tracking
      case "verify_fact":
        return verifyFact(this.toolContext, args.fact_id as string);
      
      case "get_stale_facts":
        return getStaleFacts(this.toolContext, args.days as number | undefined);
      
      // Feature 4: Citation validation
      case "validate_citations":
        return validateCitations(this.toolContext, args.fact_id as string | undefined);
      
      // Feature 5: Fact linking
      case "get_related_facts":
        return getRelatedFacts(this.toolContext, args.fact_id as string);
      
      // Feature 8: Diff-aware updates
      case "get_affected_facts":
        return getAffectedFacts(this.toolContext, args.file_path as string);
      
      // Feature 7: Export to repo
      case "export_context":
        return exportContext(this.toolContext, {
          outputPath: args.output_path as string | undefined,
          includeSymbols: args.include_symbols as boolean | undefined
        });
      
      case "summarize_long_history":
        return summarizeLongHistory(
          this.toolContext,
          args.text as string,
          args.max_tokens as number | undefined
        );
      
      case "update_project_state":
        return updateProjectState(this.toolContext);
      
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  }

  async start(): Promise<void> {
    console.error(`Context-Forge MCP Server starting...`);
    console.error(`Project root: ${PROJECT_ROOT}`);

    console.error("Indexing project...");
    try {
      const indexResult = await this.indexer.indexProject();
      console.error(`Indexed ${indexResult.indexed} files, ${indexResult.symbols} symbols`);
    } catch (error) {
      console.error(`Warning: Indexing failed - ${error instanceof Error ? error.message : "Unknown error"}`);
      console.error("Server will continue with empty index");
    }

    if (!this.stateFile.exists()) {
      const state = this.stateFile.createDefault();
      this.stateFile.save(state);
      console.error("Created initial STATE.json");
    }

    await updateProjectState(this.toolContext);

    this.watcher.start();
    console.error("File watcher started");

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MCP server connected via stdio");
  }

  async stop(): Promise<void> {
    this.watcher.stop();
    this.storage.close();
    await this.server.close();
  }
}

const server = new ContextForgeServer();

process.on("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await server.stop();
  process.exit(0);
});

server.start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
