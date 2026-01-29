# Context-Forge

A local-first MCP (Model Context Protocol) server that provides long-term memory and context management for AI-assisted development. Context-Forge solves the "Context Rot" problem by maintaining a persistent project state that survives chat resets.

## Features

- **AST Indexing**: Parses codebase structure using regex patterns for JavaScript, TypeScript, and Python
- **State Persistence**: SQLite-based storage for decisions, facts, and code symbols
- **Session Memory**: Maintains decisions and facts across chat sessions
- **File Watching**: Real-time index updates when files change
- **Ollama Integration**: Optional local LLM for summarization (falls back to basic extraction)

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

| Tool | Description |
|------|-------------|
| `get_codebase_map` | Returns structural overview of a module |
| `search_semantics` | Search across code symbols and decisions |
| `get_dependency_graph` | Shows dependencies for a symbol |
| `commit_decision` | Saves an architectural decision |
| `fetch_active_decisions` | Returns all active decisions |
| `resume_session` | Injects previous session context |
| `summarize_long_history` | Compresses conversation to briefing |
| `update_project_state` | Updates STATE.json with current stats |

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