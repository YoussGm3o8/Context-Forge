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
  getCodebaseMap,
  searchSemantics,
  getDependencyGraph,
  commitDecision,
  fetchActiveDecisions,
  resumeSession,
  summarizeLongHistory,
  updateProjectState,
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
      case "get_codebase_map":
        return getCodebaseMap(this.toolContext, args.module_path as string);
      
      case "search_semantics":
        return searchSemantics(this.toolContext, args.query as string);
      
      case "get_dependency_graph":
        return getDependencyGraph(this.toolContext, args.target as string);
      
      case "commit_decision":
        return commitDecision(
          this.toolContext,
          args.fact as string,
          args.supersedes_id as string | undefined
        );
      
      case "fetch_active_decisions":
        return fetchActiveDecisions(this.toolContext);
      
      case "resume_session":
        return resumeSession(this.toolContext);
      
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
    const indexResult = await this.indexer.indexProject();
    console.error(`Indexed ${indexResult.indexed} files, ${indexResult.symbols} symbols`);

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
