import crypto from "crypto";

export function generateId(): string {
  return crypto.randomUUID();
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateText(text: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + "...";
}

export function formatDependencyTree(
  symbol: string,
  dependencies: string[],
  dependents: string[],
  depth: number = 2
): string {
  const lines: string[] = [];
  lines.push(`Symbol: ${symbol}`);
  
  if (dependencies.length > 0) {
    lines.push("Dependencies (imports):");
    for (const dep of dependencies.slice(0, depth * 5)) {
      lines.push(`  <- ${dep}`);
    }
    if (dependencies.length > depth * 5) {
      lines.push(`  ... and ${dependencies.length - depth * 5} more`);
    }
  }
  
  if (dependents.length > 0) {
    lines.push("Dependents (used by):");
    for (const dep of dependents.slice(0, depth * 5)) {
      lines.push(`  -> ${dep}`);
    }
    if (dependents.length > depth * 5) {
      lines.push(`  ... and ${dependents.length - depth * 5} more`);
    }
  }
  
  return lines.join("\n");
}

export function formatCodeMap(
  modulePath: string,
  symbols: Array<{ name: string; type: string; startLine: number; signature?: string }>,
  imports: string[]
): string {
  const lines: string[] = [];
  lines.push(`Module: ${modulePath}`);
  lines.push("");
  
  if (imports.length > 0) {
    lines.push("Imports:");
    for (const imp of imports) {
      lines.push(`  - ${imp}`);
    }
    lines.push("");
  }
  
  const groupedSymbols: Record<string, typeof symbols> = {};
  for (const sym of symbols) {
    if (!groupedSymbols[sym.type]) {
      groupedSymbols[sym.type] = [];
    }
    groupedSymbols[sym.type].push(sym);
  }
  
  const typeOrder = ["class", "interface", "type", "function", "variable", "export"];
  for (const type of typeOrder) {
    const group = groupedSymbols[type];
    if (group && group.length > 0) {
      lines.push(`${capitalizeFirst(type)}s:`);
      for (const sym of group) {
        const sig = sym.signature ? ` - ${sym.signature}` : "";
        lines.push(`  - ${sym.name} (line ${sym.startLine})${sig}`);
      }
      lines.push("");
    }
  }
  
  return lines.join("\n").trim();
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatDecisions(decisions: Array<{ content: string; timestamp: number }>): string {
  if (decisions.length === 0) {
    return "No active decisions recorded.";
  }
  
  const lines: string[] = ["Active Project Decisions:"];
  for (const decision of decisions) {
    const date = new Date(decision.timestamp).toISOString().split("T")[0];
    lines.push(`  [${date}] ${decision.content}`);
  }
  return lines.join("\n");
}

export function formatSessionSummary(
  summaries: Array<{ summary: string; keyDecisions: string[]; timestamp: number }>
): string {
  if (summaries.length === 0) {
    return "No previous session history.";
  }
  
  const lines: string[] = ["Previous Session Summary:"];
  for (const summary of summaries.slice(0, 3)) {
    const date = new Date(summary.timestamp).toISOString();
    lines.push(`\n[${date}]`);
    lines.push(summary.summary);
    if (summary.keyDecisions.length > 0) {
      lines.push("Key decisions:");
      for (const decision of summary.keyDecisions) {
        lines.push(`  - ${decision}`);
      }
    }
  }
  return lines.join("\n");
}
