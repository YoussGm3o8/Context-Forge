export const TOOL_DEFINITIONS = [
  {
    name: "get_codebase_map",
    description: "Returns a structural overview of a module including its classes, functions, imports/exports, and dependencies without returning raw code. Saves tokens by providing high-level structure.",
    inputSchema: {
      type: "object" as const,
      properties: {
        module_path: {
          type: "string",
          description: "Path to the module or file to analyze (relative to project root)"
        }
      },
      required: ["module_path"]
    }
  },
  {
    name: "search_semantics",
    description: "Hybrid search across the codebase symbols and historical decisions. Finds relevant code symbols, past decisions, and facts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query - can be a symbol name, concept, or natural language description"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "get_dependency_graph",
    description: "Returns all upstream (imports) and downstream (dependents) dependencies for a specific file or function.",
    inputSchema: {
      type: "object" as const,
      properties: {
        target: {
          type: "string",
          description: "Name of the symbol (function, class, file) to analyze dependencies for"
        }
      },
      required: ["target"]
    }
  },
  {
    name: "commit_decision",
    description: "Permanently saves an architectural choice or design decision to the project state. Use this when making important decisions that should persist across sessions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fact: {
          type: "string",
          description: "The decision or fact to record"
        },
        supersedes_id: {
          type: "string",
          description: "Optional ID of a previous decision that this one replaces/supersedes"
        }
      },
      required: ["fact"]
    }
  },
  {
    name: "fetch_active_decisions",
    description: "Returns all active architectural decisions and facts for the project. Provides a <500 token 'Current Truth' block ensuring consistency.",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  },
  {
    name: "resume_session",
    description: "Injects a compressed summary of previous sessions into the context. Use this at the start of a new conversation to restore project knowledge.",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  },
  {
    name: "summarize_long_history",
    description: "Uses local LLM (Ollama) to compress conversation history into a structured briefing. Extracts key facts and saves them for future reference.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description: "The conversation or content to summarize"
        },
        max_tokens: {
          type: "number",
          description: "Maximum tokens for the summary (default: 500)"
        }
      },
      required: ["text"]
    }
  },
  {
    name: "update_project_state",
    description: "Updates the STATE.json file with current project statistics and active decisions. Called automatically but can be invoked manually.",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  }
];
