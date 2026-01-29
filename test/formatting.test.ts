import { describe, it, expect } from "vitest";
import {
  generateId,
  estimateTokens,
  truncateText,
  formatCodeMap,
  formatDecisions,
  formatDependencyTree
} from "../src/utils/formatting.js";

describe("Formatting utilities", () => {
  describe("generateId", () => {
    it("generates unique UUIDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe("estimateTokens", () => {
    it("estimates tokens as ~4 chars per token", () => {
      expect(estimateTokens("")).toBe(0);
      expect(estimateTokens("test")).toBe(1);
      expect(estimateTokens("hello world")).toBe(3);
    });
  });

  describe("truncateText", () => {
    it("returns text unchanged if under limit", () => {
      const text = "short text";
      expect(truncateText(text, 100)).toBe(text);
    });

    it("truncates with ellipsis when over limit", () => {
      const text = "this is a longer text that needs truncation";
      const result = truncateText(text, 5);
      expect(result.endsWith("...")).toBe(true);
      expect(result.length).toBeLessThanOrEqual(20);
    });
  });

  describe("formatCodeMap", () => {
    it("formats module overview correctly", () => {
      const result = formatCodeMap(
        "src/utils.ts",
        [
          { name: "formatData", type: "function", startLine: 10 },
          { name: "UserType", type: "interface", startLine: 1 }
        ],
        ["lodash", "./types"]
      );

      expect(result).toContain("Module: src/utils.ts");
      expect(result).toContain("Imports:");
      expect(result).toContain("lodash");
      expect(result).toContain("formatData");
      expect(result).toContain("UserType");
    });

    it("handles empty symbols", () => {
      const result = formatCodeMap("empty.ts", [], []);
      expect(result).toContain("Module: empty.ts");
    });
  });

  describe("formatDecisions", () => {
    it("formats decisions with timestamps", () => {
      const decisions = [
        { content: "Use TypeScript", timestamp: new Date("2024-01-15").getTime() },
        { content: "Use React", timestamp: new Date("2024-01-16").getTime() }
      ];

      const result = formatDecisions(decisions);
      expect(result).toContain("Active Project Decisions:");
      expect(result).toContain("Use TypeScript");
      expect(result).toContain("Use React");
    });

    it("handles empty decisions", () => {
      const result = formatDecisions([]);
      expect(result).toBe("No active decisions recorded.");
    });
  });

  describe("formatDependencyTree", () => {
    it("formats dependencies and dependents", () => {
      const result = formatDependencyTree(
        "myFunction",
        ["lodash", "fs"],
        ["main.ts"]
      );

      expect(result).toContain("Symbol: myFunction");
      expect(result).toContain("Dependencies");
      expect(result).toContain("lodash");
      expect(result).toContain("Dependents");
      expect(result).toContain("main.ts");
    });
  });
});
