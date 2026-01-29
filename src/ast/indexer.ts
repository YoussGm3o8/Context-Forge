import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { CodeSymbol, FileIndex } from "../types.js";
import type { StateStorage } from "../storage/state-storage.js";

type ParserLanguage = "javascript" | "typescript" | "python";

interface SymbolMatch {
  name: string;
  type: CodeSymbol["type"];
  startLine: number;
  endLine: number;
  signature?: string;
}

const SUPPORTED_EXTENSIONS: Record<string, ParserLanguage> = {
  ".js": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".py": "python"
};

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "__pycache__",
  ".context-forge",
  "coverage",
  ".vscode",
  ".idea"
]);

const IGNORE_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml"
]);

export class ASTIndexer {
  private storage: StateStorage;
  private projectRoot: string;

  constructor(storage: StateStorage, projectRoot: string) {
    this.storage = storage;
    this.projectRoot = projectRoot;
  }

  async indexProject(): Promise<{ indexed: number; symbols: number }> {
    const files = this.collectFiles(this.projectRoot);
    let totalSymbols = 0;

    for (const filePath of files) {
      const symbols = await this.indexFile(filePath);
      totalSymbols += symbols;
    }

    return { indexed: files.length, symbols: totalSymbols };
  }

  async indexFile(filePath: string): Promise<number> {
    const ext = path.extname(filePath);
    const language = SUPPORTED_EXTENSIONS[ext];
    if (!language) return 0;

    const content = fs.readFileSync(filePath, "utf-8");
    const hash = this.computeHash(content);
    const relativePath = path.relative(this.projectRoot, filePath);

    const existingIndex = this.storage.getFileIndex(relativePath);
    if (existingIndex && existingIndex.hash === hash) {
      return existingIndex.symbols.length;
    }

    this.storage.deleteSymbolsByFile(relativePath);

    const symbols = this.extractSymbols(content, filePath, language);
    const symbolIds: string[] = [];

    for (const symbol of symbols) {
      this.storage.saveCodeSymbol(symbol);
      symbolIds.push(symbol.id);
    }

    const fileIndex: FileIndex = {
      path: relativePath,
      hash,
      lastIndexed: Date.now(),
      symbols: symbolIds
    };
    this.storage.saveFileIndex(fileIndex);

    return symbols.length;
  }

  removeFile(filePath: string): void {
    const relativePath = path.relative(this.projectRoot, filePath);
    this.storage.deleteSymbolsByFile(relativePath);
    this.storage.deleteFileIndex(relativePath);
  }

  private collectFiles(dir: string): string[] {
    const files: string[] = [];
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (IGNORE_FILES.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.collectFiles(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (SUPPORTED_EXTENSIONS[ext]) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private extractSymbols(content: string, filePath: string, language: ParserLanguage): CodeSymbol[] {
    const relativePath = path.relative(this.projectRoot, filePath);
    const symbols: CodeSymbol[] = [];

    const matches = this.parseWithRegex(content, language);
    
    for (const match of matches) {
      const symbolId = `${relativePath}:${match.name}:${match.startLine}`;
      symbols.push({
        id: symbolId,
        name: match.name,
        type: match.type,
        filePath: relativePath,
        startLine: match.startLine,
        endLine: match.endLine,
        signature: match.signature,
        dependencies: [],
        dependents: []
      });
    }

    const imports = this.extractImports(content, language);
    for (const symbol of symbols) {
      symbol.dependencies = imports;
    }

    return symbols;
  }

  private parseWithRegex(content: string, language: ParserLanguage): SymbolMatch[] {
    const matches: SymbolMatch[] = [];
    const lines = content.split("\n");

    const patterns = this.getPatternsForLanguage(language);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      for (const pattern of patterns) {
        const match = line.match(pattern.regex);
        if (match && match[1]) {
          const endLine = this.findBlockEnd(lines, i);
          matches.push({
            name: match[1],
            type: pattern.type,
            startLine: lineNum,
            endLine,
            signature: match[0].trim()
          });
        }
      }
    }

    return matches;
  }

  private getPatternsForLanguage(language: ParserLanguage): Array<{ regex: RegExp; type: CodeSymbol["type"] }> {
    const jsPatterns = [
      { regex: /(?:export\s+)?class\s+(\w+)/, type: "class" as const },
      { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/, type: "function" as const },
      { regex: /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/, type: "function" as const },
      { regex: /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?function/, type: "function" as const },
      { regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=(?!\s*(?:async\s*)?\(|function)/, type: "variable" as const },
      { regex: /export\s+\{\s*([^}]+)\s*\}/, type: "export" as const },
      { regex: /export\s+default\s+(\w+)/, type: "export" as const }
    ];

    const tsPatterns = [
      ...jsPatterns,
      { regex: /(?:export\s+)?interface\s+(\w+)/, type: "interface" as const },
      { regex: /(?:export\s+)?type\s+(\w+)\s*=/, type: "type" as const }
    ];

    const pyPatterns = [
      { regex: /^class\s+(\w+)/, type: "class" as const },
      { regex: /^(?:async\s+)?def\s+(\w+)/, type: "function" as const },
      { regex: /^(\w+)\s*=\s*(?!def|class)/, type: "variable" as const }
    ];

    switch (language) {
      case "javascript":
        return jsPatterns;
      case "typescript":
        return tsPatterns;
      case "python":
        return pyPatterns;
      default:
        return jsPatterns;
    }
  }

  private extractImports(content: string, language: ParserLanguage): string[] {
    const imports: string[] = [];
    const lines = content.split("\n");

    if (language === "python") {
      for (const line of lines) {
        const fromMatch = line.match(/^from\s+(\S+)\s+import/);
        if (fromMatch) {
          imports.push(fromMatch[1]);
          continue;
        }
        const importMatch = line.match(/^import\s+(\S+)/);
        if (importMatch) {
          imports.push(importMatch[1]);
        }
      }
    } else {
      for (const line of lines) {
        const match = line.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/);
        if (match) {
          imports.push(match[1]);
        }
        const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          imports.push(requireMatch[1]);
        }
      }
    }

    return [...new Set(imports)];
  }

  private findBlockEnd(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let started = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === "{" || char === ":") {
          braceCount++;
          started = true;
        } else if (char === "}") {
          braceCount--;
        }
      }
      if (started && braceCount === 0) {
        return i + 1;
      }
    }

    return Math.min(startIndex + 10, lines.length);
  }

  private computeHash(content: string): string {
    return crypto.createHash("md5").update(content).digest("hex");
  }
}
