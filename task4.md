你先阅读qwen-tts和mimo-tts的文档
https://modelscope.cn/models/Qwen/Qwen3-TTS-12Hz-1.7B-Base
https://mimo.mi.com/docs/zh-CN/quick-start/usage-guide/audio/speech-synthesis-v2.5
其中有提到在克隆音频时提供参考文案和参考音频可以获得更高质量的克隆效果
你帮我调整逻辑，右侧控制区-按钮组
<button @click.stop="generateLineAudio(line)"
                                                    :data-testid="'line-generate-' + line.id"
                                                    :title="line.isGenerating ? '停止生成' : '生成音频'"
                                                    :class="['p-2', line.isGenerating ? 'text-red-500 hover:text-red-700' : 'text-slate-400 hover:text-indigo-600 disabled:text-slate-300 disabled:cursor-wait']">
                                                    <svg v-if="line.isGenerating" class="animate-spin h-4 w-4"
                                                        xmlns="http://www.w3.org/2000/svg" fill="none"
                                                        viewBox="0 0 24 24">
                                                        <circle class="opacity-25" cx="12" cy="12" r="10"
                                                            stroke="currentColor" stroke-width="4"></circle>
                                                        <path class="opacity-75" fill="currentColor"
                                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
                                                        </path>
                                                    </svg>
                                                    <svg v-else class="h-4 w-4" xmlns="http://www.w3.org/2000/svg"
                                                        viewBox="0 0 20 20" fill="currentColor">
                                                        <path fill-rule="evenodd"
                                                            d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                                                            clip-rule="evenodd" />
                                                    </svg>
                                                </button>

生成音频时需要向接口增量传入角色对应的参考文案，然后在~/github/TTS-and-VoiceDesign项目对应接口接收了参考文案后要按照实际调用模型是否支持参考文案增量传入，以获得更好的克隆效果
