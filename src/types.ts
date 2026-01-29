import type Database from "better-sqlite3";

export interface StateNode {
  id: string;
  type: "decision" | "fact" | "summary";
  content: string;
  timestamp: number;
  supersedes?: string;
  metadata?: Record<string, unknown>;
}

export interface CodeSymbol {
  id: string;
  name: string;
  type: "class" | "function" | "variable" | "import" | "export" | "interface" | "type";
  filePath: string;
  startLine: number;
  endLine: number;
  signature?: string;
  dependencies: string[];
  dependents: string[];
}

export interface FileIndex {
  path: string;
  hash: string;
  lastIndexed: number;
  symbols: string[];
}

export interface ProjectState {
  version: string;
  projectRoot: string;
  lastUpdated: number;
  activeDecisions: StateNode[];
  fileCount: number;
  symbolCount: number;
}

export interface SessionSummary {
  id: string;
  timestamp: number;
  tokenCount: number;
  summary: string;
  keyDecisions: string[];
}

export interface SearchResult {
  type: "symbol" | "decision" | "fact";
  id: string;
  content: string;
  score: number;
  context?: string;
}

export type SqliteDatabase = Database.Database;
