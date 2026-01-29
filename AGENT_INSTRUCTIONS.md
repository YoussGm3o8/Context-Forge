# Context-Forge MCP Server - AI Agent Instructions

This document provides instructions for AI agents on how to use the Context-Forge MCP server for persistent memory and context management across sessions.

## Overview

Context-Forge is a local-first MCP (Model Context Protocol) server that provides long-term memory and context management for AI-assisted development. It solves the "Context Rot" problem by maintaining a persistent project state that survives chat resets.

**IMPORTANT**: Always check if Context-Forge is available at the start of each session by calling `resume_session` to restore project knowledge.

---

## Quick Start - Session Initialization

At the **beginning of every new session**, execute the following:

```
1. Call `resume_session` to restore previous context and decisions
2. Call `fetch_active_decisions` to get the current project truth
3. Review the output to understand the project state
```

This ensures continuity across chat sessions and prevents "context rot."

---

## Available Tools

### 1. `resume_session`
**Purpose**: Restore context from previous sessions. **ALWAYS call this first in a new session.**

**When to use**:
- At the start of every new conversation
- After a long break in development
- When switching between branches or contexts

**Parameters**: None

**Example**:
```json
{ "tool": "resume_session" }
```

**Returns**: 
- Project stats (files indexed, symbols)
- Active architectural decisions
- Session summaries from previous conversations

---

### 2. `fetch_active_decisions`
**Purpose**: Get all active architectural decisions and facts for the project.

**When to use**:
- After `resume_session` for the complete picture
- Before making architectural decisions (to avoid conflicts)
- When the user asks about project conventions or decisions

**Parameters**: None

**Example**:
```json
{ "tool": "fetch_active_decisions" }
```

**Returns**: A "Current Truth" block with all active decisions (~500 tokens or less)

---

### 3. `commit_decision`
**Purpose**: Permanently save an architectural choice or design decision.

**When to use**:
- After making an important architectural decision
- When establishing coding conventions
- When documenting API contracts or interfaces
- After resolving a technical debate with the user

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fact` | string | Yes | The decision or fact to record |
| `supersedes_id` | string | No | ID of a previous decision this one replaces |

**Example**:
```json
{
  "tool": "commit_decision",
  "arguments": {
    "fact": "Use React Query for server state management instead of Redux",
    "supersedes_id": "abc123"  // optional
  }
}
```

**Best Practices**:
- Be specific and actionable in the decision text
- Include the reasoning when possible
- Use `supersedes_id` when updating or replacing a previous decision
- Commit decisions about: tech stack, patterns, conventions, important constraints

---

### 4. `get_codebase_map`
**Purpose**: Get a structural overview of a module without returning raw code.

**When to use**:
- Before modifying a file (understand its structure first)
- When exploring unfamiliar parts of the codebase
- To save tokens by getting structure instead of full code

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `module_path` | string | Yes | Path to the module/file (relative to project root) |

**Example**:
```json
{
  "tool": "get_codebase_map",
  "arguments": {
    "module_path": "src/components/Button.tsx"
  }
}
```

**Returns**: Classes, functions, imports/exports, and dependencies for the module

---

### 5. `search_semantics`
**Purpose**: Hybrid search across codebase symbols and historical decisions.

**When to use**:
- Finding where something is implemented
- Looking for related code or decisions
- Answering "how do I..." questions
- Finding code symbols by name or concept

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query (symbol name, concept, or natural language) |

**Example**:
```json
{
  "tool": "search_semantics",
  "arguments": {
    "query": "authentication handler"
  }
}
```

**Returns**: Matching code symbols, decisions, and facts ranked by relevance

---

### 6. `get_dependency_graph`
**Purpose**: Show upstream (imports) and downstream (dependents) for a symbol.

**When to use**:
- Before refactoring to understand impact
- Tracing where a function is used
- Understanding module relationships
- Planning changes that might break dependencies

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target` | string | Yes | Name of the symbol (function, class, file) |

**Example**:
```json
{
  "tool": "get_dependency_graph",
  "arguments": {
    "target": "UserService"
  }
}
```

**Returns**: Dependency tree showing imports and dependents

---

### 7. `summarize_long_history`
**Purpose**: Compress conversation history into a structured briefing using local LLM.

**When to use**:
- When conversation is getting long and you want to save context
- Before ending a productive session
- To extract and persist key facts from the conversation

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `text` | string | Yes | The conversation/content to summarize |
| `max_tokens` | number | No | Maximum tokens for summary (default: 500) |

**Example**:
```json
{
  "tool": "summarize_long_history",
  "arguments": {
    "text": "Today we discussed the API design...",
    "max_tokens": 300
  }
}
```

**Note**: Requires Ollama running locally. Falls back to basic extraction if unavailable.

---

### 8. `update_project_state`
**Purpose**: Update the STATE.json file with current project statistics.

**When to use**:
- After significant code changes
- Periodically during long sessions
- Usually called automatically; manual invocation rarely needed

**Parameters**: None

---

## Recommended Workflows

### Starting a New Session
```
1. resume_session           → Restore context
2. fetch_active_decisions   → Get current truth
3. Review and proceed with the user's task
```

### Making an Important Decision
```
1. search_semantics         → Check if related decisions exist
2. Discuss with user
3. commit_decision          → Record the decision
```

### Exploring Code
```
1. get_codebase_map         → Get structure overview
2. search_semantics         → Find related code
3. get_dependency_graph     → Understand relationships
```

### Ending a Productive Session
```
1. summarize_long_history   → Extract and save key facts
2. commit_decision          → Record any undocumented decisions
3. update_project_state     → Ensure state is current
```

---

## Storage and Persistence

Context-Forge stores data in `.context-forge/` directory:
- `state.db` - SQLite database with decisions, facts, symbols
- `STATE.json` - Human-readable project state file

**Important**: The `.context-forge/` directory is typically git-ignored. For portable context, consider committing `STATE.json` if needed.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXT_FORGE_ROOT` | Current directory | Project root to index |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.1:8b` | Model for summarization |

---

## Tips for Effective Usage

1. **Always resume at session start** - Don't skip `resume_session`
2. **Commit decisions proactively** - Record important choices as they're made
3. **Use search before creating** - Check existing decisions to avoid conflicts
4. **Be specific in decisions** - Vague decisions are less useful
5. **Supersede instead of duplicate** - Use `supersedes_id` when updating decisions
6. **Summarize long sessions** - Use `summarize_long_history` to capture value
7. **Trust the context** - Use the restored context; don't ask the user to re-explain

---

## Feature Roadmap

The following features are planned for future development:

### Planned Enhancements
- **Semantic tags + relevance filtering**: Tag facts with arbitrary tags like `["api", "video", "low-latency"]` and query with `--tags`
- **Staleness tracking**: `created_at` and `last_verified` timestamps to flag outdated facts
- **Citation validation**: Verify that referenced file/line citations still exist
- **Fact linking**: Allow facts to reference each other for contextual retrieval
- **Workspace-aware paths**: Tie memories to specific git repos by hash or remote URL
- **Export to repo**: Export memories as a `.context-forge` directory for version control
- **Diff-aware updates**: Suggest which facts might be affected by code changes
- **Priority/importance weighting**: Priority levels for retrieval ordering
- **Natural language querying**: `memory ask "how do I build the plugin?"` style queries

---

## Troubleshooting

### "No symbols found"
- Ensure the project has been indexed (check server startup logs)
- Try a more specific or less specific path
- File might not be in a supported language (JS, TS, Python)

### Ollama not available
- `summarize_long_history` will fall back to basic extraction
- Install Ollama locally for full functionality
- Check `OLLAMA_URL` environment variable

### Missing context after restart
- Ensure `.context-forge/state.db` exists and isn't corrupted
- Call `resume_session` at the start of each session
- Check that `CONTEXT_FORGE_ROOT` points to the correct project

---

## Summary

Context-Forge provides persistent memory for AI-assisted development. Key actions:

| Action | Tool | When |
|--------|------|------|
| Restore context | `resume_session` | Start of session |
| Get decisions | `fetch_active_decisions` | Need current truth |
| Save decision | `commit_decision` | After important choice |
| Explore code | `get_codebase_map` | Before modifications |
| Search | `search_semantics` | Finding code/decisions |
| Save session | `summarize_long_history` | End of session |

**Remember**: Always call `resume_session` first. Your effectiveness depends on leveraging the persistent context!
