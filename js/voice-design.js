window.voiceDesigns = [
    {
        id: 'qwen-voicedesign',
        name: 'Qwen3 VoiceDesign',
        provider: 'qwen',
        type: 'local_model',
        environment: 'qwen3-voiceDesign',
        url: 'http://127.0.0.1:8300/v1/qwen/design'
    },
    {
        id: 'moss-voicegenerator',
        name: 'MOSS VoiceGenerator',
        provider: 'moss',
        type: 'local_model',
        environment: 'moss-voiceGenerator',
        url: 'http://127.0.0.1:8300/v1/moss/design'
    },
    // 设计音色效果差，废弃
    // {
    //     id: 'ming-omni-tts',
    //     name: 'Ming-omni-tts 0.5B',
    //     provider: 'ming',
    //     type: 'local_model',
    //     environment: 'Ming-omni-tts-0.5B',
    //     url: 'http://127.0.0.1:8300/v1/Ming/design'
    // },
    {
        id: 'mimo-voicedesign',
        name: 'MiMo VoiceDesign',
        provider: 'mimo',
        type: 'cloud_api',
        url: 'http://127.0.0.1:8300/v1/mimo/design'
    },
    // {
    //     id: 'voxcpm2-voicedesign',
    //     name: 'VoxCPM2 VoiceDesign',
    //     provider: 'voxcpm2',
    //     type: 'local_model',
    //     environment: 'voxcpm2',
    //     url: 'http://127.0.0.1:8300/v1/voxcpm2/design'
    // }
];
