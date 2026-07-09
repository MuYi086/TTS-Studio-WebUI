import {
  normalizeProjectEnvelope,
  stripRuntimeProjectEnvelope,
  type ProjectEnvelope,
  type ProjectLibraries,
  type ProjectState
} from '../../domain/project';
import { openUnitaleDb, PROJECT_STORE } from './db';

const CURRENT_STATE_KEY = 'currentState';

export class ProjectRepository {
  async saveCurrentState(project: ProjectEnvelope): Promise<void> {
    const database = await openUnitaleDb();

    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(PROJECT_STORE, 'readwrite');
      tx.objectStore(PROJECT_STORE).put(project, CURRENT_STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event);
      tx.onabort = (event) => reject(event);
    });
  }

  async loadCurrentState(): Promise<ProjectEnvelope | null> {
    const database = await openUnitaleDb();

    return new Promise<ProjectEnvelope | null>((resolve) => {
      const tx = database.transaction(PROJECT_STORE, 'readonly');
      const request = tx.objectStore(PROJECT_STORE).get(CURRENT_STATE_KEY);
      request.onsuccess = () => resolve((request.result as ProjectEnvelope | undefined) ?? null);
      request.onerror = () => resolve(null);
    });
  }

  async saveCurrentStatePatch(patch: {
    libraries?: ProjectLibraries;
    project?: ProjectState;
    savedAt?: number;
  }): Promise<ProjectEnvelope> {
    const currentState = await this.loadCurrentState();
    const normalized = normalizeProjectEnvelope(currentState ?? {});
    const nextState = stripRuntimeProjectEnvelope({
      ...normalized,
      savedAt: patch.savedAt ?? Date.now(),
      libraries: patch.libraries ?? normalized.libraries,
      project: patch.project ?? normalized.project
    });

    await this.saveCurrentState(nextState);
    return nextState;
  }
}
