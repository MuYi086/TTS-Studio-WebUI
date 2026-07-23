你先阅读index.html中的
<button @click="generateQwenVoice(char)"
  :class="['flex-1 px-2 py-1.5 border rounded text-[10px] font-bold transition-colors flex justify-center items-center gap-1', char.isGeneratingVoice ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100' : 'bg-pink-50 text-pink-600 border-pink-100 hover:bg-pink-100']">
  <span v-if="char.isGeneratingVoice" class="animate-spin">⏳</span>{{ char.isGeneratingVoice ? '停止生成' : selectedVoiceDesignButtonText }}
</button>
这个generateQwenVoice函数内部做了俩个动作，先是生成参考文案，然后生成音色
现在期望将这个按钮拆分成俩个按钮，一个按钮是"生成参考文案",一个按钮是"生成音色"
在<textarea v-model="char.voiceDescription" rows="2"
                                    class="w-full px-2 py-1.5 text-[10px] border rounded bg-slate-50 focus:ring-1 focus:ring-blue-500 outline-none resize-none text-slate-600"
                                    placeholder="音色描述 (例如: 甜美少女音)"></textarea>
                                    后增加一个新的textarea,placeholder='参考文案',用来放上面"生成参考文案"按钮点击后生成的文案。新的"生成音色"按钮点击依然使用参考文案和音色描述来生成音色。从第一性原理出发