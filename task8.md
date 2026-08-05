你先阅读step-audio-editx的官方文档：
仓库地址: https://voxcpm.readthedocs.io/zh-cn/latest/usage_guide.html
demo use: https://stepaudiollm.github.io/step-audio-editx/

1. 将文档中的available tags都拆分到对应的
`editConfig/emotion.js`和`editConfig/paralinguistic.js`和`editConfig/speakingStyle.js`
以js数组对象维护，数组中每项为键值对，例如key是'happy', value是'Expressing happiness'

2. 在index.html中`情绪描述`下方的emotionPresets列表来源于上面的editConfig/emotion.js，其中的选中项应该由大模型判断输出的数据emotion中指定，例如下面的例子,其中emotion是"coldness":
 {"type": "dialogue", "role_name": "旁白", "text_content": "我高中是在烟台E中学上的，烟台是个小地方，在地图上看起来显得很远的地方。实际上骑自行车不会超过十五分钟。", "emotion": "coldness", "intensity": "中等", "clone_mode": "ultimate", "delivery_profile": "baseline", "voxcpm_nonverbal_tags": [], "needs_review": false, "break_duration": 0},

 3. 由于任务2执行需要提示词约定，所以你需要同步帮我调整"自定义 Prompt 模板=>1. 剧本拆分与分析 Prompt=>默认的提示词"
 需要告诉大模型返回每一行剧本台词的emotion只可以从editConfig/emotion.js选择一个返回

 4. 在index.html中<!-- 停顿间隔 -->和<div class="flex-grow"></div>插入一个一个button组件，名称是"使用Step-Audio-EditX"，点击之后会调用该模型的编辑功能（参考上面文档和~/github/scoring-for-TTS中modelScript/tts_local_Step_Audio_EditX.py使用，需要同步在`~/github/TTS-and-VoiceDesign`的api中增加step-audio-editx编辑的功能，以api的形式暴露给前端的index.html），对应的接口入参对应增加edit-type和edit-info的值,默认的prompt-text是当前行需要合成的文本，prompt-audio是当前行"<!-- 按钮组 -->"里播放按钮绑定的那个音频。step-audio-editx模型编辑完成后，当前行后方出现一个播放和删除的按钮，可以试听和删除刚才编辑后的音频，具体音频存储和播放可以参考原来的逻辑