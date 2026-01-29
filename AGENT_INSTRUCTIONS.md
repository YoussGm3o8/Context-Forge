# Context-Forge MCP Server - AI Agent Instructions

This document provides instructions for AI agents on how to use the Context-Forge MCP server for persistent memory and context management across sessions.

## Overview

Context-Forge is a local-first MCP (Model Context Protocol) server that provides long-term memory and context management for AI-assisted development. It solves the "Context Rot" problem by maintaining a persistent project state that survives chat resets.

**IMPORTANT**: Always call `bootstrap` at the start of each session to automatically load all stored context.

---

## Quick Start - Session Initialization

At the **beginning of every new session**, execute:

```
1. Call `bootstrap` to auto-load all facts and decisions
2. Review any stale fact warnings
3. Proceed with the user's task
```

This ensures continuity across chat sessions and prevents "context rot."

---

## Available Tools

### 1. `bootstrap` (NEW - Auto-load on session start)
**Purpose**: Automatically returns all facts and decisions at session initialization. **ALWAYS call this first.**

**When to use**:
- At the start of every new conversation
- Replaces the need to explicitly call "memory view"

**Parameters**: None

**Example**:
```json
{ "tool": "bootstrap" }
```

**Returns**: 
- All active facts and decisions
- Project stats
- Stale fact warnings (facts not verified in 30+ days)

---

### 2. `memory_store` (NEW - Store with tags, citations, priority)
**Purpose**: Store a fact or decision with semantic tags, citations, priority, and relationships.

**When to use**:
- Recording important project knowledge
- Documenting architectural decisions
- Saving information that should persist

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | The fact or decision to store |
| `type` | string | No | "fact" or "decision" (default: "fact") |
| `tags` | array | No | Semantic tags like `["api", "video", "architecture"]` |
| `citations` | array | No | File/line refs like `["src/api.py:304"]` |
| `related_to` | array | No | IDs of related facts for linking |
| `priority` | number | No | 1-5 importance (5=critical, default=3) |
| `supersedes_id` | string | No | ID of fact this replaces |

**Example**:
```json
{
  "tool": "memory_store",
  "arguments": {
    "content": "Video API uses WebRTC for low-latency streaming",
    "type": "fact",
    "tags": ["api", "video", "low-latency"],
    "citations": ["src/video/api.py:304"],
    "priority": 4
  }
}
```

---

### 3. `memory_search` (NEW - Search with tag filtering)
**Purpose**: Search memories with semantic tag filtering and relevance options.

**When to use**:
- Finding facts by category/topic
- Filtering by importance level
- Excluding stale information

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tags` | array | No | Filter by tags (returns facts matching ANY tag) |
| `limit` | number | No | Max results to return |
| `include_stale` | boolean | No | Include unverified facts (default: false) |
| `min_priority` | number | No | Minimum priority level (1-5) |

**Example**:
```json
{
  "tool": "memory_search",
  "arguments": {
    "tags": ["api", "video"],
    "limit": 5,
    "min_priority": 3
  }
}
```

---

### 4. `memory_ask` (NEW - Natural language querying)
**Purpose**: Ask questions in natural language and get relevant facts.

**When to use**:
- "How do I build the plugin?"
- "What's the authentication flow?"
- When you don't know the exact tags to search

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `question` | string | Yes | Natural language question |
| `limit` | number | No | Max results (default: 5) |

**Example**:
```json
{
  "tool": "memory_ask",
  "arguments": {
    "question": "how do I deploy to production?"
  }
}
```

---

### 5. `verify_fact` (NEW - Staleness tracking)
**Purpose**: Mark a fact as verified/current to prevent staleness warnings.

**When to use**:
- After confirming a fact is still accurate
- To reset the staleness timer

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fact_id` | string | Yes | ID of the fact to verify |

**Example**:
```json
{
  "tool": "verify_fact",
  "arguments": {
    "fact_id": "abc123-def456"
  }
}
```

---

### 6. `get_stale_facts` (NEW - Staleness tracking)
**Purpose**: Get facts that haven't been verified recently and may be outdated.

**When to use**:
- Periodic maintenance
- Before relying on old information

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `days` | number | No | Staleness threshold (default: 30) |

**Example**:
```json
{
  "tool": "get_stale_facts",
  "arguments": {
    "days": 14
  }
}
```

---

### 7. `validate_citations` (NEW - Citation validation)
**Purpose**: Verify that file/line citations in facts still exist.

**When to use**:
- After code refactoring
- To find broken references
- Periodic maintenance

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fact_id` | string | No | Specific fact to validate (default: all) |

**Example**:
```json
{
  "tool": "validate_citations",
  "arguments": {}
}
```

**Returns**: List of valid and invalid citations with details

---

### 8. `get_related_facts` (NEW - Fact linking)
**Purpose**: Get all facts related to a specific fact by its ID.

**When to use**:
- Understanding context around a fact
- Following knowledge chains
- "Show me everything about video streaming"

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fact_id` | string | Yes | ID of the fact to find relations for |

**Example**:
```json
{
  "tool": "get_related_facts",
  "arguments": {
    "fact_id": "fact-001"
  }
}
```

---

### 9. `get_affected_facts` (NEW - Diff-aware updates)
**Purpose**: Find facts that cite a specific file. Useful when code changes.

**When to use**:
- Before/after modifying a file
- To identify facts that may need updating
- Code review and maintenance

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Path to the file (relative to project root) |

**Example**:
```json
{
  "tool": "get_affected_facts",
  "arguments": {
    "file_path": "src/api/handlers.py"
  }
}
```

---

### 10. `export_context` (NEW - Export to repo)
**Purpose**: Export memories as a portable directory for version control.

**When to use**:
- Sharing context with team members
- Backing up project knowledge
- Making context portable

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `output_path` | string | No | Output directory (default: project root) |
| `include_symbols` | boolean | No | Include code symbol index |

**Example**:
```json
{
  "tool": "export_context",
  "arguments": {
    "include_symbols": true
  }
}
```

**Creates**: `.context-forge-export/` directory with JSON files

---

### 11. `commit_decision`
**Purpose**: Permanently save an architectural decision with tags, citations, and priority.

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fact` | string | Yes | The decision to record |
| `tags` | array | No | Semantic tags |
| `citations` | array | No | File/line references |
| `priority` | number | No | Importance 1-5 |
| `supersedes_id` | string | No | ID of decision this replaces |

**Example**:
```json
{
  "tool": "commit_decision",
  "arguments": {
    "fact": "Use PostgreSQL for the main database",
    "tags": ["database", "architecture"],
    "citations": ["docs/ADR-001.md"],
    "priority": 5
  }
}
```

---

### 12. `resume_session`
**Purpose**: Restore context from previous sessions (legacy, use `bootstrap` instead).

---

### 13. `fetch_active_decisions`
**Purpose**: Get all active architectural decisions.

---

### 14. `get_codebase_map`
**Purpose**: Get structural overview of a module.

---

### 15. `search_semantics`
**Purpose**: Hybrid search across codebase and decisions.

---

### 16. `get_dependency_graph`
**Purpose**: Show dependencies for a symbol.

---

### 17. `summarize_long_history`
**Purpose**: Compress conversation history using local LLM.

---

### 18. `update_project_state`
**Purpose**: Update STATE.json with current statistics.

---

## Recommended Workflows

### Starting a New Session
```
1. bootstrap                  → Auto-load all context
2. Review stale warnings      → Verify if needed
3. Proceed with task
```

### Storing Important Information
```
1. memory_store with:
   - Clear content
   - Relevant tags (for searchability)
   - File citations (for tracking)
   - Priority (1-5)
   - Related fact IDs (for linking)
```

### Finding Information
```
Option A: memory_search --tags video,api --limit 5
Option B: memory_ask "how do I configure the video API?"
Option C: search_semantics "video streaming"
```

### After Code Changes
```
1. get_affected_facts         → Find facts citing changed files
2. validate_citations         → Check if citations still valid
3. verify_fact or update      → Keep information accurate
```

### Ending a Session
```
1. commit_decision           → Record important choices
2. summarize_long_history    → Extract key facts
3. export_context            → Backup if needed
```

---

## Feature Summary

| Feature | Tool | Description |
|---------|------|-------------|
| Auto-load | `bootstrap` | Load all context at session start |
| Semantic tags | `memory_store`, `memory_search` | Categorize and filter by tags |
| Staleness | `verify_fact`, `get_stale_facts` | Track fact freshness |
| Citations | `validate_citations` | Verify file/line references |
| Linking | `get_related_facts` | Connect related information |
| Diff-aware | `get_affected_facts` | Find facts affected by code changes |
| Export | `export_context` | Portable, version-controlled context |
| Priority | `memory_store` | Weight by importance (1-5) |
| NL Query | `memory_ask` | Natural language questions |

---

## Priority Levels

| Level | Meaning | Examples |
|-------|---------|----------|
| 5 | Critical | Security credentials, breaking changes |
| 4 | High | Core architecture, API contracts |
| 3 | Normal | General facts (default) |
| 2 | Low | Nice-to-know information |
| 1 | Minimal | Temporary or trivial notes |

---

## Tags Best Practices

Use consistent, meaningful tags:
- **Domain**: `api`, `database`, `frontend`, `backend`
- **Type**: `architecture`, `convention`, `bug`, `todo`
- **Component**: `auth`, `video`, `payment`, `user`
- **Status**: `deprecated`, `experimental`, `stable`

Example: `["api", "video", "low-latency", "architecture"]`

---

## Troubleshooting

### Stale facts appearing
- Use `verify_fact` to mark facts as current
- Use `get_stale_facts` to review old information

### Citations invalid
- Use `validate_citations` to find broken references
- Update or remove facts with invalid citations

### Can't find information
- Try `memory_ask` with natural language
- Try `memory_search` with different tags
- Check if facts have `include_stale: true` needed

---

## Summary

**Always start with `bootstrap`** to load all context automatically.

Key tools for memory management:
- `bootstrap` - Auto-load at session start
- `memory_store` - Store with tags, citations, priority
- `memory_search` - Filter by tags
- `memory_ask` - Natural language queries
- `verify_fact` / `get_stale_facts` - Staleness management
- `validate_citations` - Check file references
- `get_related_facts` - Follow linked information
- `get_affected_facts` - Find facts impacted by code changes
- `export_context` - Export for version control
