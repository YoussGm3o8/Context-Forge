import fs from "fs";
import path from "path";
import type { ProjectState, StateNode } from "../types.js";

const STATE_FILE_NAME = "STATE.json";

export class StateFile {
  private projectRoot: string;
  private stateFilePath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.stateFilePath = path.join(projectRoot, ".context-forge", STATE_FILE_NAME);
  }

  load(): ProjectState | null {
    if (!fs.existsSync(this.stateFilePath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(this.stateFilePath, "utf-8");
      return JSON.parse(content) as ProjectState;
    } catch {
      return null;
    }
  }

  save(state: ProjectState): void {
    const dir = path.dirname(this.stateFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2));
  }

  update(updates: Partial<ProjectState>): ProjectState {
    const current = this.load() || this.createDefault();
    const updated: ProjectState = {
      ...current,
      ...updates,
      lastUpdated: Date.now()
    };
    this.save(updated);
    return updated;
  }

  updateDecisions(decisions: StateNode[]): ProjectState {
    return this.update({ activeDecisions: decisions });
  }

  createDefault(): ProjectState {
    return {
      version: "1.0.0",
      projectRoot: this.projectRoot,
      lastUpdated: Date.now(),
      activeDecisions: [],
      fileCount: 0,
      symbolCount: 0
    };
  }

  exists(): boolean {
    return fs.existsSync(this.stateFilePath);
  }
}
