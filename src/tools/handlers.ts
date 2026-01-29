import type { StateStorage } from "../storage/state-storage.js";
import type { StateFile } from "../storage/state-file.js";
import type { ASTIndexer } from "../ast/indexer.js";
import type { StateNode, SearchResult, CodeSymbol, MemorySearchOptions } from "../types.js";
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
import fs from "fs";
import path from "path";

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

// Feature 1: Bootstrap - Auto-load all facts at session start
export async function bootstrap(ctx: ToolContext): Promise<ToolResult> {
  const data = ctx.storage.getBootstrapData();
  const stats = ctx.storage.getStats();
  const staleFacts = ctx.storage.getStaleFacts(30);
  
  const lines: string[] = [
    "=== Context-Forge Bootstrap ===",
    "",
    `Project Stats: ${stats.fileCount} files, ${stats.symbolCount} symbols, ${stats.decisionCount} decisions, ${stats.factCount} facts`,
    ""
  ];
  
  if (staleFacts.length > 0) {
    lines.push(`⚠️  ${staleFacts.length} fact(s) may be stale (not verified in 30+ days)`);
    lines.push("");
  }
  
  if (data.length === 0) {
    lines.push("No facts or decisions stored yet.");
  } else {
    lines.push("=== Active Facts & Decisions ===");
    lines.push("");
    
    for (const node of data) {
      const date = new Date(node.timestamp).toISOString().split("T")[0];
      const priority = node.priority ? `[P${node.priority}]` : "";
      const tags = node.tags && node.tags.length > 0 ? ` #${node.tags.join(" #")}` : "";
      const isStale = staleFacts.some(s => s.id === node.id);
      const staleMarker = isStale ? " ⚠️STALE" : "";
      
      lines.push(`[${node.type}] ${priority} ${node.content}${tags}${staleMarker}`);
      lines.push(`  ID: ${node.id} | Created: ${date}`);
      if (node.citations && node.citations.length > 0) {
        lines.push(`  Citations: ${node.citations.join(", ")}`);
      }
      if (node.relatedTo && node.relatedTo.length > 0) {
        lines.push(`  Related to: ${node.relatedTo.join(", ")}`);
      }
      lines.push("");
    }
  }
  
  lines.push("=== End Bootstrap ===");
  
  const content = lines.join("\n");
  const tokens = estimateTokens(content);
  
  return {
    content: `${content}\n\n[${tokens} tokens]`
  };
}

// Feature 2: Memory search with tags filtering
export async function memorySearch(
  ctx: ToolContext,
  options: {
    tags?: string[];
    limit?: number;
    includeStale?: boolean;
    minPriority?: number;
  }
): Promise<ToolResult> {
  const searchOptions: MemorySearchOptions = {
    tags: options.tags,
    limit: options.limit,
    includeStale: options.includeStale ?? false,
    minPriority: options.minPriority
  };
  
  const results = ctx.storage.searchByTags(searchOptions);
  
  if (results.length === 0) {
    return { content: "No matching memories found." };
  }
  
  const lines: string[] = [`Found ${results.length} matching memories:\n`];
  
  for (const node of results) {
    const date = new Date(node.timestamp).toISOString().split("T")[0];
    const priority = node.priority ? `[P${node.priority}]` : "";
    const tags = node.tags && node.tags.length > 0 ? ` #${node.tags.join(" #")}` : "";
    
    lines.push(`[${node.type}] ${priority} ${node.content}${tags}`);
    lines.push(`  ID: ${node.id} | Created: ${date}`);
    lines.push("");
  }
  
  return { content: lines.join("\n") };
}

// Feature 2 & 3 & 5 & 9: Memory store with tags, priority, citations, and relations
export async function memoryStore(
  ctx: ToolContext,
  options: {
    content: string;
    type?: "fact" | "decision";
    tags?: string[];
    citations?: string[];
    relatedTo?: string[];
    priority?: number;
    supersedesId?: string;
  }
): Promise<ToolResult> {
  const now = Date.now();
  
  // Validate priority if provided
  let validatedPriority = options.priority ?? 3;
  if (options.priority !== undefined) {
    if (options.priority < 1 || options.priority > 5) {
      return {
        content: `Invalid priority: ${options.priority}. Priority must be between 1 and 5.`,
        isError: true
      };
    }
    validatedPriority = options.priority;
  }
  
  const node: StateNode = {
    id: generateId(),
    type: options.type || "fact",
    content: options.content,
    timestamp: now,
    createdAt: now,
    lastVerified: now,
    tags: options.tags,
    citations: options.citations,
    relatedTo: options.relatedTo,
    priority: validatedPriority,
    supersedes: options.supersedesId
  };
  
  ctx.storage.saveStateNode(node);
  
  // Update state file
  const decisions = ctx.storage.getActiveDecisions();
  ctx.stateFile.updateDecisions(decisions);
  
  const tagsStr = options.tags ? ` Tags: #${options.tags.join(" #")}` : "";
  const priorityStr = options.priority ? ` Priority: ${options.priority}` : "";
  
  return {
    content: `Memory stored successfully!\nID: ${node.id}\nType: ${node.type}${tagsStr}${priorityStr}`
  };
}

// Feature 10: Natural language querying
export async function memoryAsk(
  ctx: ToolContext,
  question: string,
  limit: number = 5
): Promise<ToolResult> {
  // First, try to extract keywords from the question
  const keywords = question
    .toLowerCase()
    .replace(/[?.,!]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 2 && !["how", "what", "where", "when", "why", "the", "and", "for", "can", "does"].includes(word));
  
  // Search in content using these keywords
  let allResults: StateNode[] = [];
  
  for (const keyword of keywords) {
    const searchResults = ctx.storage.searchContent(keyword);
    for (const result of searchResults) {
      if (result.type === "fact" || result.type === "decision") {
        const node = ctx.storage.getStateNode(result.id);
        if (node && !allResults.find(r => r.id === node.id)) {
          allResults.push(node);
        }
      }
    }
  }
  
  // Also check tags for matches
  const taggedResults = ctx.storage.searchByTags({ 
    tags: keywords, 
    limit: limit * 2,
    includeStale: true 
  });
  
  for (const node of taggedResults) {
    if (!allResults.find(r => r.id === node.id)) {
      allResults.push(node);
    }
  }
  
  // Sort by priority and limit
  allResults.sort((a, b) => (b.priority || 3) - (a.priority || 3));
  allResults = allResults.slice(0, limit);
  
  if (allResults.length === 0) {
    // Try using Ollama for semantic search if available
    const ollamaAvailable = await ctx.ollamaClient.isAvailable();
    if (ollamaAvailable) {
      return {
        content: `No direct matches found for: "${question}"\n\nTry rephrasing your question or use 'memory_search' with specific tags.`
      };
    }
    return {
      content: `No memories found related to: "${question}"\n\nTip: Store relevant facts using 'memory_store' with tags for better retrieval.`
    };
  }
  
  const lines: string[] = [
    `Answering: "${question}"`,
    "",
    `Found ${allResults.length} relevant memories:`,
    ""
  ];
  
  for (const node of allResults) {
    const priority = node.priority ? `[P${node.priority}]` : "";
    const tags = node.tags && node.tags.length > 0 ? ` #${node.tags.join(" #")}` : "";
    
    lines.push(`${priority} ${node.content}${tags}`);
    lines.push(`  ID: ${node.id}`);
    lines.push("");
  }
  
  return { content: lines.join("\n") };
}

// Feature 3: Verify a fact to update staleness
export async function verifyFact(
  ctx: ToolContext,
  factId: string
): Promise<ToolResult> {
  const success = ctx.storage.verifyFact(factId);
  
  if (!success) {
    return { content: `Fact with ID "${factId}" not found.`, isError: true };
  }
  
  return {
    content: `Fact "${factId}" marked as verified at ${new Date().toISOString()}`
  };
}

// Feature 3: Get stale facts
export async function getStaleFacts(
  ctx: ToolContext,
  days: number = 30
): Promise<ToolResult> {
  const staleFacts = ctx.storage.getStaleFacts(days);
  
  if (staleFacts.length === 0) {
    return { content: `No stale facts found (threshold: ${days} days).` };
  }
  
  const lines: string[] = [
    `⚠️  Found ${staleFacts.length} potentially stale facts (not verified in ${days}+ days):`,
    ""
  ];
  
  for (const node of staleFacts) {
    const lastVerified = node.lastVerified || node.createdAt || node.timestamp;
    const daysOld = Math.floor((Date.now() - lastVerified) / (24 * 60 * 60 * 1000));
    
    lines.push(`[${node.type}] ${truncateText(node.content, 80)}`);
    lines.push(`  ID: ${node.id} | Last verified: ${daysOld} days ago`);
    lines.push(`  Use 'verify_fact' with this ID to mark as current.`);
    lines.push("");
  }
  
  return { content: lines.join("\n") };
}

// Feature 4: Citation validation
export async function validateCitations(
  ctx: ToolContext,
  factId?: string
): Promise<ToolResult> {
  let factsToValidate: StateNode[];
  
  if (factId) {
    const fact = ctx.storage.getStateNode(factId);
    if (!fact) {
      return { content: `Fact with ID "${factId}" not found.`, isError: true };
    }
    factsToValidate = [fact];
  } else {
    // Get all facts with citations
    const allFacts = ctx.storage.getBootstrapData();
    factsToValidate = allFacts.filter(f => f.citations && f.citations.length > 0);
  }
  
  if (factsToValidate.length === 0) {
    return { content: "No facts with citations found to validate." };
  }
  
  const results: { factId: string; citation: string; status: "valid" | "missing_file" | "line_changed"; }[] = [];
  
  for (const fact of factsToValidate) {
    if (!fact.citations) continue;
    
    for (const citation of fact.citations) {
      // Parse citation format: "path/to/file.py:123" or just "path/to/file.py"
      const [filePath, lineStr] = citation.split(":");
      const fullPath = path.join(ctx.projectRoot, filePath);
      
      if (!fs.existsSync(fullPath)) {
        results.push({ factId: fact.id, citation, status: "missing_file" });
      } else if (lineStr) {
        const lineNum = parseInt(lineStr, 10);
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");
          if (lineNum > lines.length) {
            results.push({ factId: fact.id, citation, status: "line_changed" });
          } else {
            results.push({ factId: fact.id, citation, status: "valid" });
          }
        } catch {
          results.push({ factId: fact.id, citation, status: "missing_file" });
        }
      } else {
        results.push({ factId: fact.id, citation, status: "valid" });
      }
    }
  }
  
  const invalidResults = results.filter(r => r.status !== "valid");
  const validResults = results.filter(r => r.status === "valid");
  
  const lines: string[] = [
    `Citation Validation Results:`,
    `  ✓ Valid: ${validResults.length}`,
    `  ✗ Invalid: ${invalidResults.length}`,
    ""
  ];
  
  if (invalidResults.length > 0) {
    lines.push("⚠️  Invalid Citations:");
    for (const result of invalidResults) {
      const statusMsg = result.status === "missing_file" ? "File not found" : "Line number out of range";
      lines.push(`  - ${result.citation} (${statusMsg})`);
      lines.push(`    Fact ID: ${result.factId}`);
    }
  } else {
    lines.push("✓ All citations are valid!");
  }
  
  return { content: lines.join("\n") };
}

// Feature 5: Get related facts
export async function getRelatedFacts(
  ctx: ToolContext,
  factId: string
): Promise<ToolResult> {
  const fact = ctx.storage.getStateNode(factId);
  if (!fact) {
    return { content: `Fact with ID "${factId}" not found.`, isError: true };
  }
  
  const related = ctx.storage.getRelatedFacts(factId);
  
  const lines: string[] = [
    `Fact: ${truncateText(fact.content, 80)}`,
    `ID: ${factId}`,
    ""
  ];
  
  if (related.length === 0) {
    lines.push("No related facts linked to this entry.");
  } else {
    lines.push(`Related Facts (${related.length}):`);
    lines.push("");
    
    for (const node of related) {
      const priority = node.priority ? `[P${node.priority}]` : "";
      const tags = node.tags && node.tags.length > 0 ? ` #${node.tags.join(" #")}` : "";
      
      lines.push(`${priority} ${node.content}${tags}`);
      lines.push(`  ID: ${node.id}`);
      lines.push("");
    }
  }
  
  return { content: lines.join("\n") };
}

// Feature 8: Get facts affected by file changes
export async function getAffectedFacts(
  ctx: ToolContext,
  filePath: string
): Promise<ToolResult> {
  const affectedFacts = ctx.storage.getFactsByCitation(filePath);
  
  if (affectedFacts.length === 0) {
    return { content: `No facts cite the file: ${filePath}` };
  }
  
  const lines: string[] = [
    `⚠️  ${affectedFacts.length} fact(s) may be affected by changes to: ${filePath}`,
    "",
    "Consider reviewing and verifying these facts:",
    ""
  ];
  
  for (const node of affectedFacts) {
    const priority = node.priority ? `[P${node.priority}]` : "";
    
    lines.push(`${priority} ${truncateText(node.content, 80)}`);
    lines.push(`  ID: ${node.id}`);
    if (node.citations) {
      lines.push(`  Citations: ${node.citations.join(", ")}`);
    }
    lines.push("");
  }
  
  return { content: lines.join("\n") };
}

// Feature 7: Export context to repo
export async function exportContext(
  ctx: ToolContext,
  options: {
    outputPath?: string;
    includeSymbols?: boolean;
  }
): Promise<ToolResult> {
  // Validate outputPath to prevent path traversal
  let outputDir: string;
  if (options.outputPath) {
    // Normalize and resolve the path
    const resolvedPath = path.resolve(ctx.projectRoot, options.outputPath);
    // Ensure the resolved path is within the project root
    if (!resolvedPath.startsWith(ctx.projectRoot)) {
      return {
        content: `Invalid output path: Path must be within the project root.`,
        isError: true
      };
    }
    outputDir = path.join(resolvedPath, ".context-forge-export");
  } else {
    outputDir = path.join(ctx.projectRoot, ".context-forge-export");
  }
  
  // Create export directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Export decisions
  const decisions = ctx.storage.getActiveDecisions();
  fs.writeFileSync(
    path.join(outputDir, "decisions.json"),
    JSON.stringify(decisions, null, 2)
  );
  
  // Export facts
  const facts = ctx.storage.getAllFacts();
  fs.writeFileSync(
    path.join(outputDir, "facts.json"),
    JSON.stringify(facts, null, 2)
  );
  
  // Export session summaries
  const summaries = ctx.storage.getSessionSummaries();
  fs.writeFileSync(
    path.join(outputDir, "sessions.json"),
    JSON.stringify(summaries, null, 2)
  );
  
  // Export workspace info
  const workspaceInfo = ctx.storage.getWorkspaceInfo();
  if (workspaceInfo) {
    fs.writeFileSync(
      path.join(outputDir, "workspace.json"),
      JSON.stringify(workspaceInfo, null, 2)
    );
  }
  
  // Optionally export symbols
  if (options.includeSymbols) {
    const symbols = ctx.storage.getAllSymbols();
    fs.writeFileSync(
      path.join(outputDir, "symbols.json"),
      JSON.stringify(symbols, null, 2)
    );
  }
  
  // Create a README for the export
  const readme = `# Context-Forge Export

This directory contains exported context data from Context-Forge.

## Files

- \`decisions.json\` - Architectural decisions (${decisions.length} entries)
- \`facts.json\` - Project facts (${facts.length} entries)
- \`sessions.json\` - Session summaries (${summaries.length} entries)
${options.includeSymbols ? `- \`symbols.json\` - Code symbols index` : ""}
${workspaceInfo ? `- \`workspace.json\` - Workspace/repo information` : ""}

## Usage

This export can be committed to version control to share project context.
To import, copy these files to your \`.context-forge\` directory.

Exported at: ${new Date().toISOString()}
`;
  
  fs.writeFileSync(path.join(outputDir, "README.md"), readme);
  
  return {
    content: `Context exported to: ${outputDir}\n\nFiles created:\n  - decisions.json (${decisions.length} entries)\n  - facts.json (${facts.length} entries)\n  - sessions.json (${summaries.length} entries)${options.includeSymbols ? "\n  - symbols.json" : ""}\n  - README.md\n\nYou can commit this directory to version control.`
  };
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
    score: Math.max(0.1, 1 - (i * 0.05))
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
  options?: {
    tags?: string[];
    citations?: string[];
    priority?: number;
    supersedesId?: string;
  }
): Promise<ToolResult> {
  // Validate priority if provided
  let validatedPriority = options?.priority ?? 3;
  if (options?.priority !== undefined) {
    if (options.priority < 1 || options.priority > 5) {
      return {
        content: `Invalid priority: ${options.priority}. Priority must be between 1 and 5.`,
        isError: true
      };
    }
    validatedPriority = options.priority;
  }
  
  const now = Date.now();
  const node: StateNode = {
    id: generateId(),
    type: "decision",
    content: fact,
    timestamp: now,
    createdAt: now,
    lastVerified: now,
    tags: options?.tags,
    citations: options?.citations,
    priority: validatedPriority,
    supersedes: options?.supersedesId
  };
  
  ctx.storage.saveStateNode(node);
  
  const decisions = ctx.storage.getActiveDecisions();
  ctx.stateFile.updateDecisions(decisions);
  
  const tagsStr = options?.tags ? ` Tags: #${options.tags.join(" #")}` : "";
  const priorityStr = options?.priority ? ` Priority: ${options.priority}` : "";
  
  return {
    content: `Decision recorded: "${truncateText(fact, 100)}"\nID: ${node.id}${tagsStr}${priorityStr}`
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
