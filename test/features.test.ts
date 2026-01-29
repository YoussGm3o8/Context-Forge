import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StateStorage } from "../src/storage/state-storage.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("New Features", () => {
  let storage: StateStorage;
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "context-forge-features-"));
    storage = new StateStorage(testDir);
  });

  afterEach(() => {
    storage.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("Feature 2: Semantic tags", () => {
    it("saves and retrieves facts with tags", () => {
      const node = {
        id: "test-tagged-fact",
        type: "fact" as const,
        content: "Video API uses WebRTC for low-latency streaming",
        timestamp: Date.now(),
        tags: ["api", "video", "low-latency"]
      };

      storage.saveStateNode(node);
      const retrieved = storage.getStateNode("test-tagged-fact");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.tags).toContain("api");
      expect(retrieved?.tags).toContain("video");
      expect(retrieved?.tags).toContain("low-latency");
    });

    it("searches by tags", () => {
      storage.saveStateNode({
        id: "fact-1",
        type: "fact",
        content: "Uses React for frontend",
        timestamp: Date.now(),
        tags: ["frontend", "react"]
      });

      storage.saveStateNode({
        id: "fact-2",
        type: "fact",
        content: "API uses Express",
        timestamp: Date.now(),
        tags: ["backend", "api"]
      });

      const results = storage.searchByTags({ tags: ["api"], includeStale: true });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("fact-2");
    });
  });

  describe("Feature 3: Staleness tracking", () => {
    it("saves createdAt and lastVerified timestamps", () => {
      const now = Date.now();
      const node = {
        id: "test-timestamps",
        type: "fact" as const,
        content: "Test fact with timestamps",
        timestamp: now,
        createdAt: now,
        lastVerified: now
      };

      storage.saveStateNode(node);
      const retrieved = storage.getStateNode("test-timestamps");

      expect(retrieved?.createdAt).toBe(now);
      expect(retrieved?.lastVerified).toBe(now);
    });

    it("verifies a fact updates lastVerified", () => {
      const oldTime = Date.now() - 100000;
      storage.saveStateNode({
        id: "stale-fact",
        type: "fact",
        content: "Old fact",
        timestamp: oldTime,
        createdAt: oldTime,
        lastVerified: oldTime
      });

      const success = storage.verifyFact("stale-fact");
      expect(success).toBe(true);

      const retrieved = storage.getStateNode("stale-fact");
      expect(retrieved?.lastVerified).toBeGreaterThan(oldTime);
    });

    it("gets stale facts", () => {
      const now = Date.now();
      const oldTime = now - (35 * 24 * 60 * 60 * 1000); // 35 days ago

      storage.saveStateNode({
        id: "fresh-fact",
        type: "fact",
        content: "Fresh fact",
        timestamp: now,
        createdAt: now,
        lastVerified: now
      });

      storage.saveStateNode({
        id: "old-fact",
        type: "fact",
        content: "Old fact",
        timestamp: oldTime,
        createdAt: oldTime,
        lastVerified: oldTime
      });

      const staleFacts = storage.getStaleFacts(30);
      expect(staleFacts.length).toBe(1);
      expect(staleFacts[0].id).toBe("old-fact");
    });
  });

  describe("Feature 4: Citations", () => {
    it("saves and retrieves citations", () => {
      const node = {
        id: "fact-with-citation",
        type: "fact" as const,
        content: "The API handler is in api.py",
        timestamp: Date.now(),
        citations: ["src/api.py:304", "docs/README.md:50"]
      };

      storage.saveStateNode(node);
      const retrieved = storage.getStateNode("fact-with-citation");

      expect(retrieved?.citations).toContain("src/api.py:304");
      expect(retrieved?.citations).toContain("docs/README.md:50");
    });

    it("gets facts by citation path", () => {
      storage.saveStateNode({
        id: "fact-1",
        type: "fact",
        content: "Fact about api.py",
        timestamp: Date.now(),
        citations: ["src/api.py:10"]
      });

      storage.saveStateNode({
        id: "fact-2",
        type: "fact",
        content: "Fact about utils.py",
        timestamp: Date.now(),
        citations: ["src/utils.py:20"]
      });

      const results = storage.getFactsByCitation("api.py");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("fact-1");
    });
  });

  describe("Feature 5: Fact linking", () => {
    it("saves and retrieves related facts", () => {
      storage.saveStateNode({
        id: "fact-001",
        type: "fact",
        content: "Main architecture decision",
        timestamp: Date.now(),
        relatedTo: ["fact-002", "fact-003"]
      });

      storage.saveStateNode({
        id: "fact-002",
        type: "fact",
        content: "Related detail 1",
        timestamp: Date.now()
      });

      storage.saveStateNode({
        id: "fact-003",
        type: "fact",
        content: "Related detail 2",
        timestamp: Date.now()
      });

      const related = storage.getRelatedFacts("fact-001");
      expect(related.length).toBe(2);
      expect(related.map(r => r.id)).toContain("fact-002");
      expect(related.map(r => r.id)).toContain("fact-003");
    });
  });

  describe("Feature 6: Workspace info", () => {
    it("saves and retrieves workspace info", () => {
      storage.saveWorkspaceInfo({
        repoUrl: "https://github.com/user/repo",
        repoHash: "abc123def456",
        branch: "main"
      });

      const info = storage.getWorkspaceInfo();
      expect(info).not.toBeNull();
      expect(info?.repoUrl).toBe("https://github.com/user/repo");
      expect(info?.repoHash).toBe("abc123def456");
      expect(info?.branch).toBe("main");
    });
  });

  describe("Feature 9: Priority weighting", () => {
    it("saves and retrieves priority", () => {
      const node = {
        id: "critical-fact",
        type: "fact" as const,
        content: "SSH credentials location",
        timestamp: Date.now(),
        priority: 5
      };

      storage.saveStateNode(node);
      const retrieved = storage.getStateNode("critical-fact");

      expect(retrieved?.priority).toBe(5);
    });

    it("sorts by priority in active decisions", () => {
      storage.saveStateNode({
        id: "low-priority",
        type: "decision",
        content: "Nice to have",
        timestamp: Date.now(),
        priority: 1
      });

      storage.saveStateNode({
        id: "high-priority",
        type: "decision",
        content: "Critical decision",
        timestamp: Date.now() - 1000, // older but higher priority
        priority: 5
      });

      const decisions = storage.getActiveDecisions();
      expect(decisions[0].id).toBe("high-priority");
      expect(decisions[1].id).toBe("low-priority");
    });

    it("filters by minimum priority", () => {
      storage.saveStateNode({
        id: "low-priority",
        type: "fact",
        content: "Low priority fact",
        timestamp: Date.now(),
        priority: 2
      });

      storage.saveStateNode({
        id: "high-priority",
        type: "fact",
        content: "High priority fact",
        timestamp: Date.now(),
        priority: 4
      });

      const results = storage.searchByTags({ minPriority: 3, includeStale: true });
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("high-priority");
    });
  });

  describe("Feature 1: Bootstrap data", () => {
    it("gets all facts and decisions for bootstrap", () => {
      storage.saveStateNode({
        id: "decision-1",
        type: "decision",
        content: "Use TypeScript",
        timestamp: Date.now(),
        priority: 4
      });

      storage.saveStateNode({
        id: "fact-1",
        type: "fact",
        content: "Project uses ESM",
        timestamp: Date.now(),
        priority: 3
      });

      storage.saveStateNode({
        id: "summary-1",
        type: "summary",
        content: "Session summary",
        timestamp: Date.now()
      });

      const data = storage.getBootstrapData();
      // Should include decisions and facts, but not summaries
      expect(data.length).toBe(2);
      expect(data.map(d => d.type)).not.toContain("summary");
    });
  });
});
