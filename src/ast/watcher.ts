import chokidar from "chokidar";
import path from "path";
import type { ASTIndexer } from "./indexer.js";

const SUPPORTED_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".py"];

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private indexer: ASTIndexer;
  private projectRoot: string;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(indexer: ASTIndexer, projectRoot: string) {
    this.indexer = indexer;
    this.projectRoot = projectRoot;
  }

  start(): void {
    if (this.watcher) return;

    this.watcher = chokidar.watch(this.projectRoot, {
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/build/**",
        "**/.context-forge/**",
        "**/coverage/**"
      ],
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on("add", (filePath) => this.handleFileChange(filePath));
    this.watcher.on("change", (filePath) => this.handleFileChange(filePath));
    this.watcher.on("unlink", (filePath) => this.handleFileRemove(filePath));
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private handleFileChange(filePath: string): void {
    const ext = path.extname(filePath);
    if (!SUPPORTED_EXTENSIONS.includes(ext)) return;

    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filePath);
      this.indexer.indexFile(filePath).catch(() => {
        // Silently handle indexing errors for watched files
      });
    }, 100);

    this.debounceTimers.set(filePath, timer);
  }

  private handleFileRemove(filePath: string): void {
    const ext = path.extname(filePath);
    if (!SUPPORTED_EXTENSIONS.includes(ext)) return;

    const existing = this.debounceTimers.get(filePath);
    if (existing) {
      clearTimeout(existing);
      this.debounceTimers.delete(filePath);
    }

    this.indexer.removeFile(filePath);
  }
}
