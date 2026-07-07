你先阅读index.html
新建voice-design.js,定义一个数组，包含俩项: { name: '', url: ''},
信息来源：
Qwen: POST http://127.0.0.1:8300/v1/qwen/design
MIMO: POST http://127.0.0.1:8300/v1/mimo/design
然后我希望`左侧：角色与音色绑定栏`对应的元素顶部增加一个音色模型选择下拉框，显示的内容为voice-design定义的音色数组，默认选中第一项，值同时与<button @click="generateQwenVoice(char)">包含的'Qwen生成音色'是绑定关系，维护同一份值，点击时根据不同的音色模型像不同的服务请求设计音色，返回的音频和原来Qwen生成音色后的逻辑一致

移除旧的MOSS,替换为MIMO,其余保持不变
