帮我打通TTS-Studio-WebUI和TTS-and-VoiceDesign项目对于新增音色设计接口的链路。voice-design.js中需要新增VoxCpm2的音色设计接口，地址为http://127.0.0.1:8300/v1/voxcpm2/design,参数可以和qwen等接口一样，`~/github/TTS-and-VoiceDesign`也需要新增该接口处理，新增的voxcpm2逻辑应该新文件单独维护，不要和其他tts逻辑混用，以避免干扰。委托给voxcpm2模型设计音色时应该按照官方文档使用：下面是摘要示例
```shell
 # 音色设计
# 用自然语言描述创建全新音色，无需参考音频。格式： 在 text 开头用括号写入音色描述（如 "(音色描述)要合成的文本。"）：

wav = model.generate(
    text="(年轻女性，声音温柔甜美)你好，欢迎使用VoxCPM2！",
    cfg_value=2.0,
    inference_timesteps=10,
    seed=42,
)
sf.write("voice_design.wav", wav, model.tts_model.sample_rate)
```

详情请查看官方文档地址：https://github.com/OpenBMB/VoxCPM/blob/main/README_zh.md

然后评估下官方示例使用的seed都是固定42是否有特殊用处，还是说合成效果更好，如果有用就将项目中voxcpm接口处理的seed都设置成42，如果是随机的，那就还是保持默认值20260614

