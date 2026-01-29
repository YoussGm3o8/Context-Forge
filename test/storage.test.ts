import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StateStorage } from "../src/storage/state-storage.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("StateStorage", () => {
  let storage: StateStorage;
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "context-forge-test-"));
    storage = new StateStorage(testDir);
  });

  afterEach(() => {
    storage.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("StateNode operations", () => {
    it("saves and retrieves a state node", () => {
      const node = {
        id: "test-id-1",
        type: "decision" as const,
        content: "Use TypeScript for the project",
        timestamp: Date.now()
      };

      storage.saveStateNode(node);
      const retrieved = storage.getStateNode("test-id-1");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe("Use TypeScript for the project");
      expect(retrieved?.type).toBe("decision");
    });

    it("returns null for non-existent node", () => {
      const result = storage.getStateNode("non-existent");
      expect(result).toBeNull();
    });

    it("gets active decisions excluding superseded ones", () => {
      storage.saveStateNode({
        id: "old-decision",
        type: "decision",
        content: "Use REST API",
        timestamp: Date.now() - 1000
      });

      storage.saveStateNode({
        id: "new-decision",
        type: "decision",
        content: "Use GraphQL API",
        timestamp: Date.now(),
        supersedes: "old-decision"
      });

      const decisions = storage.getActiveDecisions();
      expect(decisions.length).toBe(1);
      expect(decisions[0].content).toBe("Use GraphQL API");
    });
  });

  describe("CodeSymbol operations", () => {
    it("saves and retrieves code symbols", () => {
      const symbol = {
        id: "src/utils.ts:formatData:10",
        name: "formatData",
        type: "function" as const,
        filePath: "src/utils.ts",
        startLine: 10,
        endLine: 25,
        signature: "function formatData(input: string): string",
        dependencies: ["lodash"],
        dependents: []
      };

      storage.saveCodeSymbol(symbol);
      const retrieved = storage.getCodeSymbol(symbol.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("formatData");
      expect(retrieved?.dependencies).toContain("lodash");
    });

    it("gets symbols by file path", () => {
      storage.saveCodeSymbol({
        id: "src/index.ts:main:1",
        name: "main",
        type: "function",
        filePath: "src/index.ts",
        startLine: 1,
        endLine: 10,
        dependencies: [],
        dependents: []
      });

      storage.saveCodeSymbol({
        id: "src/index.ts:helper:15",
        name: "helper",
        type: "function",
        filePath: "src/index.ts",
        startLine: 15,
        endLine: 20,
        dependencies: [],
        dependents: []
      });

      const symbols = storage.getSymbolsByFile("src/index.ts");
      expect(symbols.length).toBe(2);
    });

    it("searches symbols by name", () => {
      storage.saveCodeSymbol({
        id: "src/auth.ts:validateUser:1",
        name: "validateUser",
        type: "function",
        filePath: "src/auth.ts",
        startLine: 1,
        endLine: 10,
        dependencies: [],
        dependents: []
      });

      const results = storage.getSymbolsByName("validate");
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("validateUser");
    });
  });

  describe("Search functionality", () => {
    it("searches across state nodes and symbols", () => {
      storage.saveStateNode({
        id: "decision-1",
        type: "decision",
        content: "Implement authentication using JWT tokens",
        timestamp: Date.now()
      });

      storage.saveCodeSymbol({
        id: "src/auth.ts:verifyToken:1",
        name: "verifyToken",
        type: "function",
        filePath: "src/auth.ts",
        startLine: 1,
        endLine: 10,
        signature: "function verifyToken(token: string): boolean",
        dependencies: [],
        dependents: []
      });

      const results = storage.searchContent("token");
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Statistics", () => {
    it("returns correct counts", () => {
      storage.saveStateNode({
        id: "d1",
        type: "decision",
        content: "Decision 1",
        timestamp: Date.now()
      });

      storage.saveStateNode({
        id: "f1",
        type: "fact",
        content: "Fact 1",
        timestamp: Date.now()
      });

      storage.saveFileIndex({
        path: "src/index.ts",
        hash: "abc123",
        lastIndexed: Date.now(),
        symbols: ["sym1"]
      });

      const stats = storage.getStats();
      expect(stats.fileCount).toBe(1);
      expect(stats.decisionCount).toBe(1);
      expect(stats.factCount).toBe(1);
    });
  });
});
