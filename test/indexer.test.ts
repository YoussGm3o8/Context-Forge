import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ASTIndexer } from "../src/ast/indexer.js";
import { StateStorage } from "../src/storage/state-storage.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("ASTIndexer", () => {
  let storage: StateStorage;
  let indexer: ASTIndexer;
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "context-forge-ast-test-"));
    storage = new StateStorage(testDir);
    indexer = new ASTIndexer(storage, testDir);
  });

  afterEach(() => {
    storage.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("indexFile", () => {
    it("indexes TypeScript file with functions and classes", async () => {
      const tsContent = `
import { something } from "./module";

export class UserService {
  private db: Database;
  
  constructor() {
    this.db = new Database();
  }
  
  async getUser(id: string): Promise<User> {
    return this.db.find(id);
  }
}

export function formatUser(user: User): string {
  return user.name;
}

export const helper = () => {
  return true;
};

export interface User {
  id: string;
  name: string;
}

export type UserId = string;
`;

      const filePath = path.join(testDir, "service.ts");
      fs.writeFileSync(filePath, tsContent);

      const symbolCount = await indexer.indexFile(filePath);
      expect(symbolCount).toBeGreaterThan(0);

      const symbols = storage.getSymbolsByFile("service.ts");
      const symbolNames = symbols.map(s => s.name);

      expect(symbolNames).toContain("UserService");
      expect(symbolNames).toContain("formatUser");
      expect(symbolNames).toContain("User");
    });

    it("indexes JavaScript file", async () => {
      const jsContent = `
const express = require("express");

class Router {
  routes = [];
  
  add(path, handler) {
    this.routes.push({ path, handler });
  }
}

function createApp() {
  return express();
}

module.exports = { Router, createApp };
`;

      const filePath = path.join(testDir, "app.js");
      fs.writeFileSync(filePath, jsContent);

      await indexer.indexFile(filePath);
      const symbols = storage.getSymbolsByFile("app.js");

      expect(symbols.some(s => s.name === "Router")).toBe(true);
      expect(symbols.some(s => s.name === "createApp")).toBe(true);
    });

    it("indexes Python file", async () => {
      const pyContent = `
from typing import List
import os

class DataProcessor:
    def __init__(self, config):
        self.config = config
    
    def process(self, data: List[str]) -> List[str]:
        return [item.upper() for item in data]

def main():
    processor = DataProcessor({})
    result = processor.process(["test"])
    print(result)

DEFAULT_VALUE = 42
`;

      const filePath = path.join(testDir, "processor.py");
      fs.writeFileSync(filePath, pyContent);

      await indexer.indexFile(filePath);
      const symbols = storage.getSymbolsByFile("processor.py");

      expect(symbols.some(s => s.name === "DataProcessor")).toBe(true);
      expect(symbols.some(s => s.name === "main")).toBe(true);
    });

    it("skips unchanged files on re-index", async () => {
      const content = "export function test() { return true; }";
      const filePath = path.join(testDir, "test.ts");
      fs.writeFileSync(filePath, content);

      await indexer.indexFile(filePath);
      const firstIndex = storage.getFileIndex("test.ts");

      await indexer.indexFile(filePath);
      const secondIndex = storage.getFileIndex("test.ts");

      expect(firstIndex?.lastIndexed).toBe(secondIndex?.lastIndexed);
    });

    it("re-indexes when file changes", async () => {
      const filePath = path.join(testDir, "changing.ts");
      fs.writeFileSync(filePath, "export function v1() {}");

      await indexer.indexFile(filePath);
      const firstSymbols = storage.getSymbolsByFile("changing.ts");
      expect(firstSymbols.some(s => s.name === "v1")).toBe(true);

      fs.writeFileSync(filePath, "export function v2() {}");
      await indexer.indexFile(filePath);
      const secondSymbols = storage.getSymbolsByFile("changing.ts");

      expect(secondSymbols.some(s => s.name === "v2")).toBe(true);
      expect(secondSymbols.some(s => s.name === "v1")).toBe(false);
    });
  });

  describe("indexProject", () => {
    it("indexes all supported files in directory", async () => {
      fs.writeFileSync(
        path.join(testDir, "index.ts"),
        "export function main() {}"
      );
      fs.writeFileSync(
        path.join(testDir, "utils.js"),
        "function helper() {}"
      );
      
      fs.mkdirSync(path.join(testDir, "src"));
      fs.writeFileSync(
        path.join(testDir, "src", "app.ts"),
        "export class App {}"
      );

      const result = await indexer.indexProject();

      expect(result.indexed).toBe(3);
      expect(result.symbols).toBeGreaterThan(0);
    });

    it("ignores node_modules and hidden directories", async () => {
      fs.mkdirSync(path.join(testDir, "node_modules"));
      fs.writeFileSync(
        path.join(testDir, "node_modules", "pkg.js"),
        "function ignored() {}"
      );

      fs.mkdirSync(path.join(testDir, ".hidden"));
      fs.writeFileSync(
        path.join(testDir, ".hidden", "secret.ts"),
        "export function secret() {}"
      );

      fs.writeFileSync(
        path.join(testDir, "main.ts"),
        "export function main() {}"
      );

      const result = await indexer.indexProject();
      expect(result.indexed).toBe(1);
    });
  });

  describe("removeFile", () => {
    it("removes file index and symbols", async () => {
      const filePath = path.join(testDir, "toremove.ts");
      fs.writeFileSync(filePath, "export class ToRemove {}");

      await indexer.indexFile(filePath);
      expect(storage.getSymbolsByFile("toremove.ts").length).toBeGreaterThan(0);

      indexer.removeFile(filePath);
      expect(storage.getSymbolsByFile("toremove.ts").length).toBe(0);
      expect(storage.getFileIndex("toremove.ts")).toBeNull();
    });
  });
});
