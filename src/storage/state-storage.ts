import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { StateNode, CodeSymbol, FileIndex, SessionSummary, SqliteDatabase } from "../types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS state_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  supersedes TEXT,
  metadata TEXT
);

CREATE TABLE IF NOT EXISTS code_symbols (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  signature TEXT,
  dependencies TEXT NOT NULL,
  dependents TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS file_index (
  path TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  last_indexed INTEGER NOT NULL,
  symbols TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_summaries (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  summary TEXT NOT NULL,
  key_decisions TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_state_type ON state_nodes(type);
CREATE INDEX IF NOT EXISTS idx_state_timestamp ON state_nodes(timestamp);
CREATE INDEX IF NOT EXISTS idx_symbol_name ON code_symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbol_file ON code_symbols(file_path);
CREATE INDEX IF NOT EXISTS idx_symbol_type ON code_symbols(type);
`;

export class StateStorage {
  private db: SqliteDatabase;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    const dbPath = path.join(projectRoot, ".context-forge", "state.db");
    
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
  }

  saveStateNode(node: StateNode): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO state_nodes (id, type, content, timestamp, supersedes, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      node.id,
      node.type,
      node.content,
      node.timestamp,
      node.supersedes || null,
      node.metadata ? JSON.stringify(node.metadata) : null
    );
  }

  getStateNode(id: string): StateNode | null {
    const stmt = this.db.prepare("SELECT * FROM state_nodes WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToStateNode(row);
  }

  getActiveDecisions(): StateNode[] {
    const stmt = this.db.prepare(`
      SELECT * FROM state_nodes 
      WHERE type = 'decision' 
      AND id NOT IN (SELECT supersedes FROM state_nodes WHERE supersedes IS NOT NULL)
      ORDER BY timestamp DESC
    `);
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(row => this.rowToStateNode(row));
  }

  getAllFacts(): StateNode[] {
    const stmt = this.db.prepare(`
      SELECT * FROM state_nodes WHERE type = 'fact' ORDER BY timestamp DESC
    `);
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(row => this.rowToStateNode(row));
  }

  private rowToStateNode(row: Record<string, unknown>): StateNode {
    return {
      id: row.id as string,
      type: row.type as StateNode["type"],
      content: row.content as string,
      timestamp: row.timestamp as number,
      supersedes: row.supersedes as string | undefined,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : undefined
    };
  }

  saveCodeSymbol(symbol: CodeSymbol): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO code_symbols 
      (id, name, type, file_path, start_line, end_line, signature, dependencies, dependents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      symbol.id,
      symbol.name,
      symbol.type,
      symbol.filePath,
      symbol.startLine,
      symbol.endLine,
      symbol.signature || null,
      JSON.stringify(symbol.dependencies),
      JSON.stringify(symbol.dependents)
    );
  }

  getCodeSymbol(id: string): CodeSymbol | null {
    const stmt = this.db.prepare("SELECT * FROM code_symbols WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToCodeSymbol(row);
  }

  getSymbolsByFile(filePath: string): CodeSymbol[] {
    const stmt = this.db.prepare("SELECT * FROM code_symbols WHERE file_path = ?");
    const rows = stmt.all(filePath) as Record<string, unknown>[];
    return rows.map(row => this.rowToCodeSymbol(row));
  }

  getSymbolsByName(name: string): CodeSymbol[] {
    const stmt = this.db.prepare("SELECT * FROM code_symbols WHERE name LIKE ?");
    const rows = stmt.all(`%${name}%`) as Record<string, unknown>[];
    return rows.map(row => this.rowToCodeSymbol(row));
  }

  getAllSymbols(): CodeSymbol[] {
    const stmt = this.db.prepare("SELECT * FROM code_symbols");
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(row => this.rowToCodeSymbol(row));
  }

  deleteSymbolsByFile(filePath: string): void {
    const stmt = this.db.prepare("DELETE FROM code_symbols WHERE file_path = ?");
    stmt.run(filePath);
  }

  private rowToCodeSymbol(row: Record<string, unknown>): CodeSymbol {
    return {
      id: row.id as string,
      name: row.name as string,
      type: row.type as CodeSymbol["type"],
      filePath: row.file_path as string,
      startLine: row.start_line as number,
      endLine: row.end_line as number,
      signature: row.signature as string | undefined,
      dependencies: JSON.parse(row.dependencies as string),
      dependents: JSON.parse(row.dependents as string)
    };
  }

  saveFileIndex(file: FileIndex): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_index (path, hash, last_indexed, symbols)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(file.path, file.hash, file.lastIndexed, JSON.stringify(file.symbols));
  }

  getFileIndex(filePath: string): FileIndex | null {
    const stmt = this.db.prepare("SELECT * FROM file_index WHERE path = ?");
    const row = stmt.get(filePath) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      path: row.path as string,
      hash: row.hash as string,
      lastIndexed: row.last_indexed as number,
      symbols: JSON.parse(row.symbols as string)
    };
  }

  deleteFileIndex(filePath: string): void {
    const stmt = this.db.prepare("DELETE FROM file_index WHERE path = ?");
    stmt.run(filePath);
  }

  saveSessionSummary(summary: SessionSummary): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO session_summaries (id, timestamp, token_count, summary, key_decisions)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      summary.id,
      summary.timestamp,
      summary.tokenCount,
      summary.summary,
      JSON.stringify(summary.keyDecisions)
    );
  }

  getSessionSummaries(): SessionSummary[] {
    const stmt = this.db.prepare("SELECT * FROM session_summaries ORDER BY timestamp DESC");
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      timestamp: row.timestamp as number,
      tokenCount: row.token_count as number,
      summary: row.summary as string,
      keyDecisions: JSON.parse(row.key_decisions as string)
    }));
  }

  searchContent(query: string): Array<{ type: string; id: string; content: string }> {
    const results: Array<{ type: string; id: string; content: string }> = [];
    const searchTerm = `%${query.toLowerCase()}%`;

    const stateStmt = this.db.prepare(`
      SELECT id, type, content FROM state_nodes 
      WHERE LOWER(content) LIKE ?
    `);
    const stateRows = stateStmt.all(searchTerm) as Record<string, unknown>[];
    for (const row of stateRows) {
      results.push({
        type: row.type as string,
        id: row.id as string,
        content: row.content as string
      });
    }

    const symbolStmt = this.db.prepare(`
      SELECT id, type, name, file_path, signature FROM code_symbols 
      WHERE LOWER(name) LIKE ? OR LOWER(signature) LIKE ?
    `);
    const symbolRows = symbolStmt.all(searchTerm, searchTerm) as Record<string, unknown>[];
    for (const row of symbolRows) {
      results.push({
        type: "symbol",
        id: row.id as string,
        content: `${row.type}: ${row.name} in ${row.file_path}${row.signature ? ` - ${row.signature}` : ""}`
      });
    }

    return results;
  }

  getStats(): { fileCount: number; symbolCount: number; decisionCount: number; factCount: number } {
    const fileCount = (this.db.prepare("SELECT COUNT(*) as count FROM file_index").get() as { count: number }).count;
    const symbolCount = (this.db.prepare("SELECT COUNT(*) as count FROM code_symbols").get() as { count: number }).count;
    const decisionCount = (this.db.prepare("SELECT COUNT(*) as count FROM state_nodes WHERE type = 'decision'").get() as { count: number }).count;
    const factCount = (this.db.prepare("SELECT COUNT(*) as count FROM state_nodes WHERE type = 'fact'").get() as { count: number }).count;
    return { fileCount, symbolCount, decisionCount, factCount };
  }

  close(): void {
    this.db.close();
  }
}
