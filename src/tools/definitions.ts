export const TOOL_DEFINITIONS = [
  {
    name: "bootstrap",
    description: "Returns all facts and decisions at session initialization. Call this at the start of every new session to automatically load all stored context. This replaces the need to explicitly call 'memory view'.",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  },
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
    name: "memory_search",
    description: "Search memories with semantic tag filtering and relevance options. Supports arbitrary tags for categorization.",
    inputSchema: {
      type: "object" as const,
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags to filter by (e.g., ['api', 'video', 'low-latency']). Returns facts matching ANY of the specified tags."
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: all)"
        },
        include_stale: {
          type: "boolean",
          description: "Include facts that haven't been verified recently (default: false)"
        },
        min_priority: {
          type: "number",
          description: "Minimum priority level (1-5, where 5 is highest)"
        }
      }
    }
  },
  {
    name: "memory_store",
    description: "Store a fact or decision with semantic tags, citations, priority, and relationships to other facts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "The fact or decision content to store"
        },
        type: {
          type: "string",
          enum: ["fact", "decision"],
          description: "Type of memory (default: 'fact')"
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Semantic tags for categorization (e.g., ['api', 'video', 'architecture'])"
        },
        citations: {
          type: "array",
          items: { type: "string" },
          description: "File/line references (e.g., ['src/api.py:304', 'docs/README.md:50'])"
        },
        related_to: {
          type: "array",
          items: { type: "string" },
          description: "IDs of related facts for contextual linking"
        },
        priority: {
          type: "number",
          minimum: 1,
          maximum: 5,
          description: "Importance level 1-5 (5 is critical, 3 is default)"
        },
        supersedes_id: {
          type: "string",
          description: "ID of a previous fact this one replaces"
        }
      },
      required: ["content"]
    }
  },
  {
    name: "memory_ask",
    description: "Natural language query for memories. Ask questions like 'how do I build the plugin?' and get relevant facts.",
    inputSchema: {
      type: "object" as const,
      properties: {
        question: {
          type: "string",
          description: "Natural language question about the project"
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 5)"
        }
      },
      required: ["question"]
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
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Semantic tags for categorization"
        },
        citations: {
          type: "array",
          items: { type: "string" },
          description: "File/line references supporting this decision"
        },
        priority: {
          type: "number",
          minimum: 1,
          maximum: 5,
          description: "Importance level 1-5 (5 is critical)"
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
    name: "verify_fact",
    description: "Mark a fact as verified/current. Updates the last_verified timestamp to prevent staleness warnings.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fact_id: {
          type: "string",
          description: "The ID of the fact to verify"
        }
      },
      required: ["fact_id"]
    }
  },
  {
    name: "get_stale_facts",
    description: "Get facts that haven't been verified recently and may be outdated. Helps identify information that needs review.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days to consider for staleness (default: 30)"
        }
      }
    }
  },
  {
    name: "validate_citations",
    description: "Validate that file/line citations in facts still exist. Alerts when files are deleted or lines have changed significantly.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fact_id: {
          type: "string",
          description: "Optional fact ID to validate citations for. If not provided, validates all facts with citations."
        }
      }
    }
  },
  {
    name: "get_related_facts",
    description: "Get all facts related to a specific fact by its ID. Enables contextual retrieval of linked information.",
    inputSchema: {
      type: "object" as const,
      properties: {
        fact_id: {
          type: "string",
          description: "The ID of the fact to find relations for"
        }
      },
      required: ["fact_id"]
    }
  },
  {
    name: "get_affected_facts",
    description: "Given a file path, find all facts that cite that file. Useful for diff-aware updates when code changes.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Path to the file to check (relative to project root)"
        }
      },
      required: ["file_path"]
    }
  },
  {
    name: "export_context",
    description: "Export memories as a portable .context-forge directory that can be committed to the repo for version control.",
    inputSchema: {
      type: "object" as const,
      properties: {
        output_path: {
          type: "string",
          description: "Optional output directory path (default: project root)"
        },
        include_symbols: {
          type: "boolean",
          description: "Include code symbol index in export (default: false)"
        }
      }
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
