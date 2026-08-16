window.voiceDesigns = [
    {
        id: 'qwen-voicedesign',
        name: 'Qwen3 VoiceDesign',
        provider: 'qwen',
        type: 'local_model',
        environment: 'qwen3_voiceDesign',
        url: 'http://127.0.0.1:8301/v1/qwen/timbre'
    },
    {
        id: 'moss-voicegenerator',
        name: 'MOSS VoiceGenerator',
        provider: 'moss',
        type: 'local_model',
        environment: 'moss_voiceGenerator',
        url: 'http://127.0.0.1:8302/v1/moss/timbre'
    },
    {
        id: 'mimo-voicedesign',
        name: 'MiMo VoiceDesign',
        provider: 'mimo',
        type: 'cloud_api',
        url: 'http://127.0.0.1:8303/v1/mimo/timbre'
    }
];
