import { PreferenceRepository } from './preferenceRepository';

export const SCRIPT_WORKFLOW_STORAGE_KEYS = {
  bgImageCount: 'unitale_bgImageCount',
  selectedVoiceDesignUrl: 'storyforge_voice_design_url',
  videoResolution: 'unitale_video_resolution'
} as const;

const DEFAULT_VIDEO_RESOLUTION = '1920x1080';

export class ScriptWorkflowPreferenceRepository {
  constructor(private readonly preferenceRepository = new PreferenceRepository()) {}

  getBgImageCount(): number {
    const raw = this.preferenceRepository.getString(SCRIPT_WORKFLOW_STORAGE_KEYS.bgImageCount);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  setBgImageCount(value: number): void {
    this.preferenceRepository.setString(
      SCRIPT_WORKFLOW_STORAGE_KEYS.bgImageCount,
      String(Math.max(0, Number(value) || 0))
    );
  }

  getSelectedVoiceDesignUrl(): string {
    return (
      this.preferenceRepository.getString(
        SCRIPT_WORKFLOW_STORAGE_KEYS.selectedVoiceDesignUrl
      ) ?? ''
    );
  }

  setSelectedVoiceDesignUrl(value: string): void {
    if (value) {
      this.preferenceRepository.setString(
        SCRIPT_WORKFLOW_STORAGE_KEYS.selectedVoiceDesignUrl,
        value
      );
      return;
    }

    this.preferenceRepository.remove(SCRIPT_WORKFLOW_STORAGE_KEYS.selectedVoiceDesignUrl);
  }

  getVideoResolution(): string {
    return (
      this.preferenceRepository.getString(SCRIPT_WORKFLOW_STORAGE_KEYS.videoResolution) ??
      DEFAULT_VIDEO_RESOLUTION
    );
  }

  setVideoResolution(value: string): void {
    this.preferenceRepository.setString(
      SCRIPT_WORKFLOW_STORAGE_KEYS.videoResolution,
      value || DEFAULT_VIDEO_RESOLUTION
    );
  }
}
