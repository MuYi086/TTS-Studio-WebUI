你先阅读voxcpm2的官方文档：
使用指南: https://voxcpm.readthedocs.io/zh-cn/latest/usage_guide.html
最佳实践: https://voxcpm.readthedocs.io/zh-cn/latest/cookbook.html

1. 帮我对应优化`~/github/TTS-Studio-WebUI`中index.html中"自定义 Prompt 模板" => 1. 剧本拆分与分析 Prompt, 2. 角色音色分析 Prompt, 3. Qwen / MiMo 音色参考文本策略 (前面1，2是重点参考最佳实践:非语言标签等效果要加上，3可优化可不优化)

2. 对应调整`~/github/TTS-and-VoiceDesign`中voxcpm2合成和克隆音频的逻辑,
然后将"生成参数"放在脚本顶部作为全局变量(增加注释)和赋值，这样我可以改变值，来测试合成和克隆音频的时长和效果，以便于找到最均衡的配置

3. clone_mode: "controllable" 时要按照最佳实践优化