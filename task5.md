你先阅读`~/github/TTS-and-VoiceDesign`项目`克隆音频建议.md`
总结出所有模型通用的音色建议，要求音色参考音频为5-10s，最好是10s。然后按照总结后的建议，
将这个textarea中绑定的提示词优化，强制要求输出参考文案长度在24个字内，这样生成音色wav在10s内，最好是10s长度
<textarea v-model="customVoiceReferencePromptTemplate" :disabled="!useDynamicVoiceReferenceText"
                    :class="['w-full h-64 p-3 text-xs font-mono border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-3', !useDynamicVoiceReferenceText ? 'bg-slate-100 text-slate-400' : 'bg-white text-slate-700']"
                    spellcheck="false"></textarea>
