import type { StateStorage } from "../storage/state-storage.js";
import type { StateFile } from "../storage/state-file.js";
import type { ASTIndexer } from "../ast/indexer.js";
import type { StateNode, SearchResult, CodeSymbol } from "../types.js";
import { OllamaClient } from "../utils/ollama.js";
import {
  generateId,
  formatCodeMap,
  formatDependencyTree,
  formatDecisions,
  formatSessionSummary,
  estimateTokens,
  truncateText
} from "../utils/formatting.js";

export interface ToolContext {
  storage: StateStorage;
  stateFile: StateFile;
  indexer: ASTIndexer;
  ollamaClient: OllamaClient;
  projectRoot: string;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export async function getCodebaseMap(
  ctx: ToolContext,
  modulePath: string
): Promise<ToolResult> {
  const symbols = ctx.storage.getSymbolsByFile(modulePath);
  
  if (symbols.length === 0) {
    const allSymbols = ctx.storage.getAllSymbols();
    const matchingFiles = [...new Set(allSymbols.map(s => s.filePath))]
      .filter(f => f.includes(modulePath));
    
    if (matchingFiles.length === 0) {
      return { content: `No symbols found for module: ${modulePath}`, isError: true };
    }
    
    if (matchingFiles.length === 1) {
      const fileSymbols = ctx.storage.getSymbolsByFile(matchingFiles[0]);
      return formatCodeMapResult(matchingFiles[0], fileSymbols);
    }
    
    return {
      content: `Multiple matches found:\n${matchingFiles.map(f => `  - ${f}`).join("\n")}\nPlease specify a more exact path.`
    };
  }
  
  return formatCodeMapResult(modulePath, symbols);
}

function formatCodeMapResult(modulePath: string, symbols: CodeSymbol[]): ToolResult {
  const imports = symbols.length > 0 ? symbols[0].dependencies : [];
  const formatted = formatCodeMap(
    modulePath,
    symbols.map(s => ({
      name: s.name,
      type: s.type,
      startLine: s.startLine,
      signature: s.signature
    })),
    imports
  );
  return { content: formatted };
}

export async function searchSemantics(
  ctx: ToolContext,
  query: string
): Promise<ToolResult> {
  const results = ctx.storage.searchContent(query);
  
  if (results.length === 0) {
    return { content: `No results found for query: "${query}"` };
  }
  
  const formatted: SearchResult[] = results.map((r, i) => ({
    type: r.type as SearchResult["type"],
    id: r.id,
    content: r.content,
    score: 1 - (i * 0.1)
  }));
  
  const lines = [`Search results for "${query}":\n`];
  for (const result of formatted.slice(0, 20)) {
    lines.push(`[${result.type}] ${result.content}`);
    if (result.id) lines.push(`  ID: ${result.id}`);
    lines.push("");
  }
  
  if (results.length > 20) {
    lines.push(`... and ${results.length - 20} more results`);
  }
  
  return { content: lines.join("\n") };
}

export async function getDependencyGraph(
  ctx: ToolContext,
  target: string
): Promise<ToolResult> {
  const symbols = ctx.storage.getSymbolsByName(target);
  
  if (symbols.length === 0) {
    return { content: `No symbol found matching: ${target}`, isError: true };
  }
  
  const results: string[] = [];
  for (const symbol of symbols.slice(0, 5)) {
    const formatted = formatDependencyTree(
      `${symbol.name} (${symbol.filePath}:${symbol.startLine})`,
      symbol.dependencies,
      symbol.dependents
    );
    results.push(formatted);
    results.push("");
  }
  
  return { content: results.join("\n").trim() };
}

export async function commitDecision(
  ctx: ToolContext,
  fact: string,
  supersedesId?: string
): Promise<ToolResult> {
  const node: StateNode = {
    id: generateId(),
    type: "decision",
    content: fact,
    timestamp: Date.now(),
    supersedes: supersedesId
  };
  
  ctx.storage.saveStateNode(node);
  
  const decisions = ctx.storage.getActiveDecisions();
  ctx.stateFile.updateDecisions(decisions);
  
  return {
    content: `Decision recorded: "${truncateText(fact, 100)}"\nID: ${node.id}`
  };
}

export async function fetchActiveDecisions(
  ctx: ToolContext
): Promise<ToolResult> {
  const decisions = ctx.storage.getActiveDecisions();
  const formatted = formatDecisions(
    decisions.map(d => ({ content: d.content, timestamp: d.timestamp }))
  );
  
  const tokens = estimateTokens(formatted);
  return {
    content: `${formatted}\n\n[${tokens} tokens]`
  };
}

export async function resumeSession(
  ctx: ToolContext
): Promise<ToolResult> {
  const summaries = ctx.storage.getSessionSummaries();
  const decisions = ctx.storage.getActiveDecisions();
  const stats = ctx.storage.getStats();
  
  const lines: string[] = [
    "=== Context-Forge Session Resume ===",
    "",
    `Project Stats: ${stats.fileCount} files, ${stats.symbolCount} symbols indexed`,
    "",
    formatDecisions(decisions.map(d => ({ content: d.content, timestamp: d.timestamp }))),
    "",
    formatSessionSummary(summaries.map(s => ({
      summary: s.summary,
      keyDecisions: s.keyDecisions,
      timestamp: s.timestamp
    }))),
    "",
    "=== End Context Brief ==="
  ];
  
  const content = lines.join("\n");
  const tokens = estimateTokens(content);
  
  return {
    content: `${content}\n\n[${tokens} tokens]`
  };
}

export async function summarizeLongHistory(
  ctx: ToolContext,
  text: string,
  maxTokens: number = 500
): Promise<ToolResult> {
  const ollamaAvailable = await ctx.ollamaClient.isAvailable();
  
  if (!ollamaAvailable) {
    const lines = text.split("\n");
    const summary = lines
      .filter(line => line.includes("decision") || line.includes("implement") || line.includes("use"))
      .slice(0, 10)
      .join("\n");
    
    return {
      content: `[Ollama not available - basic extraction]\n\n${summary || "No key content extracted."}`
    };
  }
  
  try {
    const summary = await ctx.ollamaClient.summarize(text, maxTokens);
    const facts = await ctx.ollamaClient.extractFacts(text);
    
    for (const fact of facts) {
      const node: StateNode = {
        id: generateId(),
        type: "fact",
        content: fact,
        timestamp: Date.now()
      };
      ctx.storage.saveStateNode(node);
    }
    
    ctx.storage.saveSessionSummary({
      id: generateId(),
      timestamp: Date.now(),
      tokenCount: estimateTokens(text),
      summary,
      keyDecisions: facts.slice(0, 5)
    });
    
    return { content: `Summary:\n${summary}\n\nExtracted ${facts.length} facts.` };
  } catch (error) {
    return {
      content: `Summarization failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      isError: true
    };
  }
}

export async function updateProjectState(
  ctx: ToolContext
): Promise<ToolResult> {
  const stats = ctx.storage.getStats();
  const decisions = ctx.storage.getActiveDecisions();
  
  const state = ctx.stateFile.update({
    fileCount: stats.fileCount,
    symbolCount: stats.symbolCount,
    activeDecisions: decisions
  });
  
  return {
    content: `Project state updated:\n  Files: ${state.fileCount}\n  Symbols: ${state.symbolCount}\n  Active decisions: ${decisions.length}`
  };
}
