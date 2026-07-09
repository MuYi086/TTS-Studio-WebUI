import type { CharacterBinding, ProjectEnvelope, ScriptLine } from './types';
import { cloneData, ensureArray } from './utils';
import { normalizeProjectEnvelope } from './normalize';

const stripCharacterRuntime = (character: CharacterBinding): CharacterBinding => {
  const safe = cloneData(character);

  delete safe.isAnalyzing;
  delete safe.isGeneratingVoice;
  delete safe.abortController;

  return safe;
};

const stripLineRuntime = (line: ScriptLine): ScriptLine => {
  const safe = cloneData(line);

  delete safe.audioUrl;
  delete safe.imageUrl;
  delete safe.isGenerating;
  delete safe.abortController;

  return safe;
};

export const stripRuntimeProjectEnvelope = (rawProject: unknown): ProjectEnvelope => {
  const normalized = normalizeProjectEnvelope(rawProject);

  normalized.project.scriptList = normalized.project.scriptList.map((script) => ({
    ...script,
    data: {
      ...script.data,
      characters: ensureArray<CharacterBinding>(script.data.characters).map(stripCharacterRuntime),
      scriptLines: ensureArray<ScriptLine>(script.data.scriptLines).map(stripLineRuntime)
    }
  }));

  return normalized;
};
