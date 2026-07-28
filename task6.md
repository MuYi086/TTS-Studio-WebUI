你先阅读https://github.com/meituan-longcat/LongCat-AudioDiT
从Experimental Results on Seed Benchmark表格中找到所有开源的tts模型，放到数组a中，
然后a增加dots.tts、indextts2、omniVoice、voxcpm2
然后遍历数组a，找出每个所在模型在huggingface或者github的官方仓库地址，访问并查找文档提供的克隆的示例，找出克隆接口支持情绪控制或表演控制的模型。
将这些符合的模型整理后输出`克隆支持情绪控制表演或表演控制的模型.md`