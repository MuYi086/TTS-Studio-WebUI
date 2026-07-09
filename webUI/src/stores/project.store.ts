import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import {
  cloneData,
  createBgImageLine,
  createBgmLine,
  createCharacterBinding,
  createDialogueLine,
  createScriptEntry,
  normalizeProjectEnvelope,
  type BgImageLine,
  type BgmLine,
  type CharacterBinding,
  type DialogueLine,
  type ProjectState,
  type ScriptEntry,
  type ScriptLine
} from '../domain/project';
import { ProjectRepository } from '../services/storage/projectRepository';

const projectRepository = new ProjectRepository();

export const useProjectStore = defineStore('project', () => {
  const isHydrated = ref(false);
  const isSaving = ref(false);
  const projectState = ref<ProjectState>(normalizeProjectEnvelope({}).project);
  const persistTimer = ref<ReturnType<typeof globalThis.setTimeout> | null>(null);

  const ensureCurrentScript = () => {
    if (projectState.value.scriptList.length === 0) {
      projectState.value.scriptList = [createScriptEntry({ id: 'default', name: '脚本 1' })];
    }

    if (
      !projectState.value.currentScriptId ||
      !projectState.value.scriptList.some(
        (script) => script.id === projectState.value.currentScriptId
      )
    ) {
      projectState.value.currentScriptId = projectState.value.scriptList[0]?.id ?? 'default';
    }
  };

  const currentScript = computed<ScriptEntry | null>(() => {
    ensureCurrentScript();
    return (
      projectState.value.scriptList.find(
        (script) => script.id === projectState.value.currentScriptId
      ) ?? projectState.value.scriptList[0] ?? null
    );
  });

  const currentCharacters = computed(() => currentScript.value?.data.characters ?? []);
  const currentScriptLines = computed(() => currentScript.value?.data.scriptLines ?? []);

  const availableRoles = computed(() => {
    const names = new Set<string>();

    currentCharacters.value.forEach((character) => {
      if (character.name) {
        names.add(character.name);
      }
    });

    currentScriptLines.value.forEach((line) => {
      if (line.type === 'dialogue' && line.role) {
        names.add(line.role);
      }
    });

    return Array.from(names);
  });

  const lineTypeCounts = computed(() => ({
    dialogue: currentScriptLines.value.filter((line) => line.type === 'dialogue').length,
    bgm: currentScriptLines.value.filter((line) => line.type === 'bgm').length,
    bgImage: currentScriptLines.value.filter((line) => line.type === 'bgImage').length
  }));

  const persistProjectNow = async () => {
    if (!isHydrated.value) {
      return;
    }

    if (persistTimer.value !== null) {
      globalThis.clearTimeout(persistTimer.value);
      persistTimer.value = null;
    }

    isSaving.value = true;

    try {
      await projectRepository.saveCurrentStatePatch({
        project: cloneData(projectState.value),
        savedAt: Date.now()
      });
    } finally {
      isSaving.value = false;
    }
  };

  const queuePersist = () => {
    if (!isHydrated.value) {
      return;
    }

    if (persistTimer.value !== null) {
      globalThis.clearTimeout(persistTimer.value);
    }

    persistTimer.value = globalThis.setTimeout(() => {
      void persistProjectNow();
    }, 180);
  };

  const hydrate = async () => {
    if (isHydrated.value) {
      return;
    }

    const loadedState = await projectRepository.loadCurrentState();
    projectState.value = normalizeProjectEnvelope(loadedState ?? {}).project;
    ensureCurrentScript();
    isHydrated.value = true;
  };

  const replaceProjectState = (nextProjectState: ProjectState) => {
    if (persistTimer.value !== null) {
      globalThis.clearTimeout(persistTimer.value);
      persistTimer.value = null;
    }

    projectState.value = cloneData(
      normalizeProjectEnvelope({ project: nextProjectState }).project
    );
    ensureCurrentScript();
  };

  const setCurrentScriptId = (scriptId: string) => {
    const matched = projectState.value.scriptList.find((script) => script.id === scriptId);

    if (matched) {
      projectState.value.currentScriptId = matched.id;
    }
  };

  const addScript = () => {
    const nextScript = createScriptEntry({
      name: `脚本 ${projectState.value.scriptList.length + 1}`
    });

    projectState.value.scriptList.push(nextScript);
    projectState.value.currentScriptId = nextScript.id;
    return nextScript.id;
  };

  const renameScript = (scriptId: string, name: string) => {
    const target = projectState.value.scriptList.find((script) => script.id === scriptId);

    if (!target) {
      return;
    }

    target.name = name.trim() || target.name;
  };

  const deleteScript = (scriptId: string): boolean => {
    if (projectState.value.scriptList.length <= 1) {
      return false;
    }

    const currentIndex = projectState.value.scriptList.findIndex(
      (script) => script.id === scriptId
    );

    if (currentIndex === -1) {
      return false;
    }

    projectState.value.scriptList.splice(currentIndex, 1);

    if (projectState.value.currentScriptId === scriptId) {
      const nextScript =
        projectState.value.scriptList[Math.max(0, currentIndex - 1)] ??
        projectState.value.scriptList[0];

      projectState.value.currentScriptId = nextScript?.id ?? 'default';
    }

    return true;
  };

  const updateCurrentScript = (updater: (script: ScriptEntry) => void) => {
    const activeScript = currentScript.value;

    if (!activeScript) {
      return;
    }

    updater(activeScript);
  };

  const updateRawScript = (value: string) => {
    updateCurrentScript((script) => {
      script.data.rawScript = value;
    });
  };

  const updateRawAnalysisResult = (value: string) => {
    updateCurrentScript((script) => {
      script.data.rawAnalysisResult = value;
    });
  };

  const replaceCurrentScriptData = (
    patch: Partial<ScriptEntry['data']>
  ) => {
    updateCurrentScript((script) => {
      script.data = {
        ...script.data,
        ...cloneData(patch)
      };
    });
  };

  const setCurrentCharacters = (characters: CharacterBinding[]) => {
    updateCurrentScript((script) => {
      script.data.characters = cloneData(characters);
    });
  };

  const setCurrentScriptLines = (scriptLines: ScriptLine[]) => {
    updateCurrentScript((script) => {
      script.data.scriptLines = cloneData(scriptLines);
    });
  };

  const addCharacter = () => {
    updateCurrentScript((script) => {
      script.data.characters.push(createCharacterBinding());
    });
  };

  const updateCharacter = (
    characterId: string,
    patch: Partial<CharacterBinding>
  ) => {
    updateCurrentScript((script) => {
      const target = script.data.characters.find((character) => character.id === characterId);

      if (!target) {
        return;
      }

      Object.assign(target, patch);
    });
  };

  const removeCharacter = (characterId: string) => {
    updateCurrentScript((script) => {
      script.data.characters = script.data.characters.filter(
        (character) => character.id !== characterId
      );
    });
  };

  const getInsertIndex = (selectedLineId = '') => {
    const lineIndex = currentScriptLines.value.findIndex((line) => line.id === selectedLineId);
    return lineIndex === -1 ? currentScriptLines.value.length : lineIndex + 1;
  };

  const addLine = (line: DialogueLine | BgmLine | BgImageLine, selectedLineId = '') => {
    updateCurrentScript((script) => {
      script.data.scriptLines.splice(getInsertIndex(selectedLineId), 0, line);
    });
    return line.id;
  };

  const addDialogueLine = (selectedLineId = '') => {
    return addLine(createDialogueLine(), selectedLineId);
  };

  const addBgmLine = (selectedLineId = '', bgmName = '') => {
    return addLine(createBgmLine({ bgmName }), selectedLineId);
  };

  const addBgImageLine = (selectedLineId = '') => {
    return addLine(createBgImageLine(), selectedLineId);
  };

  const updateScriptLine = (lineId: string, patch: Partial<ScriptLine>) => {
    updateCurrentScript((script) => {
      const target = script.data.scriptLines.find((line) => line.id === lineId);

      if (!target) {
        return;
      }

      Object.assign(target, patch);
    });
  };

  const removeScriptLine = (lineId: string) => {
    updateCurrentScript((script) => {
      script.data.scriptLines = script.data.scriptLines.filter((line) => line.id !== lineId);
    });
  };

  const moveScriptLine = (lineId: string, direction: 'up' | 'down') => {
    updateCurrentScript((script) => {
      const currentIndex = script.data.scriptLines.findIndex((line) => line.id === lineId);

      if (currentIndex === -1) {
        return;
      }

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      if (targetIndex < 0 || targetIndex >= script.data.scriptLines.length) {
        return;
      }

      const [item] = script.data.scriptLines.splice(currentIndex, 1);
      script.data.scriptLines.splice(targetIndex, 0, item);
    });
  };

  watch(
    projectState,
    () => {
      if (!isHydrated.value) {
        return;
      }

      ensureCurrentScript();
      queuePersist();
    },
    { deep: true }
  );

  return {
    isHydrated,
    isSaving,
    projectState,
    currentScript,
    currentCharacters,
    currentScriptLines,
    availableRoles,
    lineTypeCounts,
    hydrate,
    replaceProjectState,
    persistProjectNow,
    setCurrentScriptId,
    addScript,
    renameScript,
    deleteScript,
    updateRawScript,
    updateRawAnalysisResult,
    replaceCurrentScriptData,
    setCurrentCharacters,
    setCurrentScriptLines,
    addCharacter,
    updateCharacter,
    removeCharacter,
    addDialogueLine,
    addBgmLine,
    addBgImageLine,
    updateScriptLine,
    removeScriptLine,
    moveScriptLine
  };
});
