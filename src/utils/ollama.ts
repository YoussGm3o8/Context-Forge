export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeout: number;
}

export interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

const DEFAULT_CONFIG: OllamaConfig = {
  baseUrl: "http://localhost:11434",
  model: "llama3.1:8b",
  timeout: 30000
};

export class OllamaClient {
  private config: OllamaConfig;

  constructor(config: Partial<OllamaConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async summarize(text: string, maxTokens: number = 500): Promise<string> {
    const prompt = `Summarize the following conversation/content into a concise briefing. 
Focus on: key decisions made, important technical details, and action items.
Keep the summary under ${maxTokens} tokens.
Output only the summary, no preamble.

Content:
${text}`;

    return this.generate(prompt);
  }

  async extractFacts(text: string): Promise<string[]> {
    const prompt = `Extract key facts and decisions from the following text.
Return each fact on a new line, prefixed with "- ".
Focus on: architectural decisions, design patterns chosen, requirements clarified, problems solved.
Output only the facts, no other text.

Text:
${text}`;

    const response = await this.generate(prompt);
    return response
      .split("\n")
      .map(line => line.replace(/^-\s*/, "").trim())
      .filter(line => line.length > 0);
  }

  async checkConflict(existingDecision: string, newDecision: string): Promise<{ conflicts: boolean; resolution?: string }> {
    const prompt = `Compare these two statements and determine if they conflict:

Existing: ${existingDecision}
New: ${newDecision}

If they conflict, explain briefly how to resolve it.
Format response as:
CONFLICTS: yes/no
RESOLUTION: (only if conflicts=yes) brief explanation

Output only in this format.`;

    const response = await this.generate(prompt);
    const conflictsMatch = response.match(/CONFLICTS:\s*(yes|no)/i);
    const resolutionMatch = response.match(/RESOLUTION:\s*(.+)/i);

    return {
      conflicts: conflictsMatch?.[1]?.toLowerCase() === "yes",
      resolution: resolutionMatch?.[1]
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async generate(prompt: string): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: false
      }),
      signal: AbortSignal.timeout(this.config.timeout)
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json() as OllamaResponse;
    return data.response;
  }
}
