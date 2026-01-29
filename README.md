# Context-Forge

A local-first MCP (Model Context Protocol) server that provides long-term memory and context management for AI-assisted development. Context-Forge solves the "Context Rot" problem by maintaining a persistent project state that survives chat resets.

## Features

- **AST Indexing**: Parses codebase structure using regex patterns for JavaScript, TypeScript, and Python
- **State Persistence**: SQLite-based storage for decisions, facts, and code symbols
- **Session Memory**: Maintains decisions and facts across chat sessions
- **File Watching**: Real-time index updates when files change
- **Ollama Integration**: Optional local LLM for summarization (falls back to basic extraction)
- **Semantic Tags**: Tag facts with arbitrary tags for categorization and filtering
- **Staleness Tracking**: Timestamps and verification to flag potentially outdated information
- **Citation Validation**: Verify that file/line references still exist
- **Fact Linking**: Connect related facts for contextual retrieval
- **Priority Weighting**: Importance levels (1-5) for retrieval ordering
- **Natural Language Queries**: Ask questions in plain English
- **Export to Repo**: Export context for version control

## Installation

```bash
npm install
npm run build
```

## Configuration

Set these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXT_FORGE_ROOT` | Current directory | Project root to index |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.1:8b` | Model for summarization |

## MCP Tools

### Memory Management
| Tool | Description |
|------|-------------|
| `bootstrap` | **Auto-load all facts at session start** |
| `memory_store` | Store fact/decision with tags, citations, priority, relations |
| `memory_search` | Search with tag filtering and priority thresholds |
| `memory_ask` | Natural language queries ("how do I...?") |

### Staleness & Validation
| Tool | Description |
|------|-------------|
| `verify_fact` | Mark a fact as verified/current |
| `get_stale_facts` | Get facts not verified in N days |
| `validate_citations` | Check if file/line citations still exist |

### Contextual Retrieval
| Tool | Description |
|------|-------------|
| `get_related_facts` | Get facts linked to a specific fact |
| `get_affected_facts` | Find facts citing a specific file (diff-aware) |

### Export & Persistence
| Tool | Description |
|------|-------------|
| `export_context` | Export to `.context-forge-export/` for version control |
| `update_project_state` | Updates STATE.json with current stats |

### Code Analysis
| Tool | Description |
|------|-------------|
| `get_codebase_map` | Returns structural overview of a module |
| `search_semantics` | Search across code symbols and decisions |
| `get_dependency_graph` | Shows dependencies for a symbol |

### Decisions & Sessions
| Tool | Description |
|------|-------------|
| `commit_decision` | Saves an architectural decision with tags/priority |
| `fetch_active_decisions` | Returns all active decisions |
| `resume_session` | Injects previous session context |
| `summarize_long_history` | Compresses conversation to briefing |

## AI Agent Instructions

For detailed instructions on how AI agents should use Context-Forge, see [AGENT_INSTRUCTIONS.md](./AGENT_INSTRUCTIONS.md).

**Quick Start for AI Agents**: Always call `bootstrap` at the beginning of each new session to auto-load all context.

## Usage with Claude Desktop

Add to your MCP settings:

```json
{
  "mcpServers": {
    "context-forge": {
      "command": "node",
      "args": ["/path/to/context-forge/dist/index.js"],
      "env": {
        "CONTEXT_FORGE_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

## Development

```bash
npm run dev      # Run with tsx
npm run build    # Compile TypeScript
npm run test     # Run tests
npm run lint     # Run ESLint
```

## Project Structure

```
src/
  index.ts           # MCP server entry point
  types.ts           # TypeScript interfaces
  storage/
    state-storage.ts # SQLite storage engine
    state-file.ts    # STATE.json management
  ast/
    indexer.ts       # Code symbol extraction
    watcher.ts       # File change monitoring
  tools/
    definitions.ts   # MCP tool schemas
    handlers.ts      # Tool implementations
  utils/
    formatting.ts    # Output formatting helpers
    ollama.ts        # Ollama client
```

## License

MIT