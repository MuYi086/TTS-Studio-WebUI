import {
  PROJECT_KIND,
  PROJECT_SCHEMA_VERSION,
  PROJECT_VERSION_LABEL
} from './constants';
import type {
  AudioLibraryItem,
  BgImageLine,
  BgmLine,
  CharacterBinding,
  DialogueLine,
  DialogueSfxCue,
  EmotionPreset,
  FilterLibraryItem,
  JsonObject,
  NormalizeLookupOptions,
  ProjectEnvelope,
  ScriptEntry,
  ScriptLine,
  TimbreLibraryItem
} from './types';
import {
  asObject,
  cloneData,
  createAssetKey,
  createId,
  createVoiceLookup,
  ensureArray,
  isExternalAssetPath,
  normalizeTrimRange,
  toNumber
} from './utils';

type LibraryKind = 'sfx' | 'bgm' | 'timbre';

const normalizeLibraryItem = (
  kind: LibraryKind,
  item: unknown
): AudioLibraryItem | TimbreLibraryItem => {
  const source = cloneData(asObject(item));
  const trim = normalizeTrimRange(source, 0, 1);
  const isTimbre = kind === 'timbre';

  source.id = typeof source.id === 'string' ? source.id : createId(kind);
  source.assetKey = typeof source.assetKey === 'string' ? source.assetKey : '';

  if (isTimbre) {
    const refPath = typeof source.refPath === 'string' ? source.refPath : '';
    let assetKey = source.assetKey as string;

    if (!assetKey && refPath && !isExternalAssetPath(refPath)) {
      assetKey = createAssetKey('legacy_timbre', refPath);
    }

    return {
      ...source,
      id: source.id as string,
      assetKey,
      name: typeof source.name === 'string' && source.name ? source.name : '未命名音色',
      description: typeof source.description === 'string' ? source.description : '',
      promptText: typeof source.promptText === 'string' ? source.promptText : '',
      refPath
    };
  }

  const filename = typeof source.filename === 'string' ? source.filename : '';
  let assetKey = source.assetKey as string;

  if (!assetKey && filename && !isExternalAssetPath(filename)) {
    assetKey = createAssetKey(`legacy_${kind}`, filename);
  }

  return {
    ...source,
    id: source.id as string,
    assetKey,
    name: typeof source.name === 'string' ? source.name : '',
    description: typeof source.description === 'string' ? source.description : '',
    filename,
    trimStart: trim.trimStart,
    trimEnd: trim.trimEnd,
    volume: toNumber(source.volume, 0.3),
    enabled: source.enabled !== false
  };
};

const normalizeCharacter = (
  character: unknown,
  options: NormalizeLookupOptions = {}
): CharacterBinding => {
  const source = cloneData(asObject(character));
  const name = typeof source.name === 'string' && source.name ? source.name : '旁白';
  const voiceFile = typeof source.voiceFile === 'string' ? source.voiceFile : '';
  const matchedByPath = voiceFile && options.voiceKeyByPath
    ? options.voiceKeyByPath.get(voiceFile) ?? ''
    : '';
  const matchedByName = options.voiceKeyByName?.get(name);
  const voiceDescription =
    typeof source.voiceDescription === 'string'
      ? source.voiceDescription
      : matchedByName?.description ?? '';
  const voicePromptText =
    typeof source.voicePromptText === 'string'
      ? source.voicePromptText
      : matchedByName?.promptText ?? '';

  return {
    ...source,
    id: typeof source.id === 'string' ? source.id : createId('char'),
    name,
    voiceFile: voiceFile || matchedByName?.refPath || '',
    voiceAssetKey:
      (typeof source.voiceAssetKey === 'string' ? source.voiceAssetKey : '') ||
      matchedByPath ||
      matchedByName?.assetKey ||
      '',
    volume: toNumber(source.volume, 1),
    voiceDescription,
    voicePromptText
  };
};

const inferCharactersFromLines = (
  lines: ScriptLine[],
  options: NormalizeLookupOptions = {}
): CharacterBinding[] => {
  const roleNames = new Set<string>();

  lines.forEach((line) => {
    if (line.type === 'dialogue' && line.role) {
      roleNames.add(line.role);
    }
  });

  return Array.from(roleNames).map((roleName) => {
    const matched = options.voiceKeyByName?.get(roleName);
    return normalizeCharacter(
      {
        name: roleName,
        voiceFile: matched?.refPath ?? '',
        voiceAssetKey: matched?.assetKey ?? '',
        volume: 1
      },
      options
    );
  });
};

const mergeCharacters = (
  existingCharacters: CharacterBinding[],
  inferredCharacters: CharacterBinding[]
): CharacterBinding[] => {
  const merged = new Map<string, CharacterBinding>();

  existingCharacters.forEach((character) => {
    if (character.name && !merged.has(character.name)) {
      merged.set(character.name, character);
    }
  });

  inferredCharacters.forEach((character) => {
    if (character.name && !merged.has(character.name)) {
      merged.set(character.name, character);
    }
  });

  return Array.from(merged.values());
};

const normalizeDialogueSfx = (value: unknown): DialogueSfxCue[] => {
  return ensureArray<unknown>(value).map((item) => {
    const source = asObject(item);
    return {
      name: typeof source.name === 'string' ? source.name : '',
      position: toNumber(source.position, 0)
    };
  });
};

const normalizeDialogueLine = (line: unknown, id: string): DialogueLine => {
  const source = cloneData(asObject(line));
  const trim = normalizeTrimRange(source, 0, 1);

  return {
    ...source,
    id,
    type: 'dialogue',
    role:
      (typeof source.role_name === 'string' && source.role_name) ||
      (typeof source.role === 'string' && source.role) ||
      '旁白',
    text:
      (typeof source.text_content === 'string' && source.text_content) ||
      (typeof source.text === 'string' && source.text) ||
      (typeof source.content === 'string' && source.content) ||
      '',
    emotion: typeof source.emotion === 'string' && source.emotion ? source.emotion : '平静',
    intensity:
      typeof source.intensity === 'string' && source.intensity ? source.intensity : '中等',
    filter: typeof source.filter === 'string' ? source.filter : '',
    sfx: normalizeDialogueSfx(source.sfx),
    break_duration: toNumber(source.break_duration, 0),
    trimStart: trim.trimStart,
    trimEnd: trim.trimEnd,
    sfxVolume: toNumber(source.sfxVolume, 1),
    dialogueVolume: toNumber(
      source.dialogueVolume !== undefined ? source.dialogueVolume : source.volume,
      1
    ),
    speed: toNumber(source.speed, 1),
    audioAssetKey:
      (typeof source.audioAssetKey === 'string' ? source.audioAssetKey : '') ||
      `line_audio_${id}`,
    audioUrl: '',
    isGenerating: false
  };
};

const normalizeBgmLine = (line: unknown, id: string): BgmLine => {
  const source = cloneData(asObject(line));

  return {
    ...source,
    id,
    type: 'bgm',
    action:
      typeof source.action === 'string' && source.action
        ? source.action
        : 'play',
    volume: toNumber(source.volume, 1),
    bgmName:
      (typeof source.bgmName === 'string' && source.bgmName) ||
      (typeof source.name === 'string' ? source.name : '') ||
      ''
  };
};

const normalizeBgImageLine = (line: unknown, id: string): BgImageLine => {
  const source = cloneData(asObject(line));

  return {
    ...source,
    id,
    type: 'bgImage',
    bgImagePrompt:
      (typeof source.bgImagePrompt === 'string' && source.bgImagePrompt) ||
      (typeof source.image_prompt === 'string' && source.image_prompt) ||
      (typeof source.imagePrompt === 'string' && source.imagePrompt) ||
      (typeof source.prompt === 'string' ? source.prompt : '') ||
      '',
    bgImageAssetKey:
      (typeof source.bgImageAssetKey === 'string' ? source.bgImageAssetKey : '') ||
      `bgImage_${id}`,
    imageUrl: '',
    imageMimeType: typeof source.imageMimeType === 'string' ? source.imageMimeType : ''
  };
};

const normalizeScriptLine = (line: unknown): ScriptLine => {
  const source = asObject(line);
  const id = typeof source.id === 'string' && source.id ? source.id : createId('line');
  const type = typeof source.type === 'string' && source.type ? source.type : 'dialogue';

  if (type === 'bgm') {
    return normalizeBgmLine(source, id);
  }

  if (type === 'bgImage') {
    return normalizeBgImageLine(source, id);
  }

  return normalizeDialogueLine(source, id);
};

const normalizeScriptEntry = (
  script: unknown,
  options: NormalizeLookupOptions = {}
): ScriptEntry => {
  const source = cloneData(asObject(script));
  const data = asObject(source.data);
  const normalizedLines = ensureArray<unknown>(data.scriptLines).map(normalizeScriptLine);
  const providedCharacters = ensureArray<unknown>(data.characters).length
    ? ensureArray<unknown>(data.characters)
    : ensureArray<CharacterBinding>(options.fallbackCharacters);
  const normalizedProvidedCharacters = providedCharacters.map((character) =>
    normalizeCharacter(character, options)
  );
  const inferredCharacters = inferCharactersFromLines(normalizedLines, options);

  return {
    id:
      (typeof source.id === 'string' && source.id) ||
      options.defaultId ||
      createId('script'),
    name:
      (typeof source.name === 'string' && source.name) ||
      options.defaultName ||
      '脚本 1',
    data: {
      rawScript:
        (typeof data.rawScript === 'string' && data.rawScript) ||
        options.rawScript ||
        '',
      rawAnalysisResult:
        (typeof data.rawAnalysisResult === 'string' && data.rawAnalysisResult) ||
        options.rawAnalysisResult ||
        '',
      characters: mergeCharacters(normalizedProvidedCharacters, inferredCharacters),
      scriptLines: normalizedLines
    }
  };
};

export const normalizeProjectEnvelope = (rawProject: unknown): ProjectEnvelope => {
  const source = cloneData(asObject(rawProject));
  const projectSource = asObject(source.project ?? source);
  const librariesSource = asObject(source.libraries);
  const timbres = ensureArray<unknown>(librariesSource.timbres).map((item) =>
    normalizeLibraryItem('timbre', item)
  ) as TimbreLibraryItem[];
  const voiceLookup = createVoiceLookup(timbres);
  let scriptListSource = ensureArray<unknown>(projectSource.scriptList);
  const legacyCharacters = ensureArray<unknown>(projectSource.characters ?? source.characters);
  const currentScriptIdCandidate =
    (typeof projectSource.currentScriptId === 'string' && projectSource.currentScriptId) ||
    (typeof source.currentScriptId === 'string' && source.currentScriptId) ||
    'default';

  if (!scriptListSource.length) {
    scriptListSource = [
      {
        id: currentScriptIdCandidate || 'default',
        name: '脚本 1',
        data: {
          rawScript:
            (typeof projectSource.rawScript === 'string' && projectSource.rawScript) ||
            (typeof source.rawScript === 'string' ? source.rawScript : '') ||
            '',
          rawAnalysisResult:
            (typeof projectSource.rawAnalysisResult === 'string' && projectSource.rawAnalysisResult) ||
            (typeof source.rawAnalysisResult === 'string' ? source.rawAnalysisResult : '') ||
            '',
          characters: legacyCharacters,
          scriptLines: projectSource.scriptLines ?? source.scriptLines ?? []
        }
      }
    ];
  }

  const normalizedScriptList = scriptListSource.map((script, index) =>
    normalizeScriptEntry(script, {
      timbres,
      voiceKeyByPath: voiceLookup.byPath,
      voiceKeyByName: voiceLookup.byName,
      fallbackCharacters:
        asObject(script).data &&
        Array.isArray(asObject(asObject(script).data).characters) &&
        ensureArray(asObject(asObject(script).data).characters).length
          ? []
          : asObject(script).id
            ? (asObject(script).id === currentScriptIdCandidate ? legacyCharacters : [])
            : index === 0
              ? legacyCharacters
              : [],
      defaultId: index === 0 ? 'default' : createId('script'),
      defaultName: `脚本 ${index + 1}`
    })
  );

  const currentScriptId = normalizedScriptList.some(
    (script) => script.id === currentScriptIdCandidate
  )
    ? currentScriptIdCandidate
    : normalizedScriptList[0]?.id ?? 'default';

  return {
    kind: PROJECT_KIND,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    version: PROJECT_VERSION_LABEL,
    savedAt: toNumber(source.savedAt ?? source.timestamp ?? Date.now(), Date.now()),
    libraries: {
      sfx: ensureArray<unknown>(librariesSource.sfx).map((item) =>
        normalizeLibraryItem('sfx', item)
      ) as AudioLibraryItem[],
      bgm: ensureArray<unknown>(librariesSource.bgm).map((item) =>
        normalizeLibraryItem('bgm', item)
      ) as AudioLibraryItem[],
      timbres,
      filters: cloneData(ensureArray<FilterLibraryItem>(librariesSource.filters)) || [],
      emotions: cloneData(ensureArray<EmotionPreset>(librariesSource.emotions)) || []
    },
    project: {
      currentScriptId,
      scriptList: normalizedScriptList
    }
  };
};
