import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the video codes and the texts the capability writes into rows, Vietnamese and English. */
export const VIDEO_MESSAGES: MessageBundle = {
    vi: {
        "errors.VIDEO_PROJECT_NOT_FOUND": "Kh\u00f4ng t\u00ecm th\u1ea5y video n\u00e0y.",
        "errors.VIDEO_PROJECT_BUSY":
            "Video \u0111ang \u0111\u01b0\u1ee3c so\u1ea1n ho\u1eb7c d\u1ef1ng, ch\u1edd xong r\u1ed3i d\u1ef1ng ti\u1ebfp nh\u00e9.",
        "errors.VIDEO_SPEC_INVALID": "K\u1ecbch b\u1ea3n ch\u01b0a d\u1ef1ng \u0111\u01b0\u1ee3c: {{reason}}",
        "errors.VIDEO_RENDER_REJECTED": "Kh\u00f4ng d\u1ef1ng \u0111\u01b0\u1ee3c video n\u00e0y: {{reason}}",
        "errors.VIDEO_STORAGE_FAILED": "Kh\u00f4ng l\u01b0u \u0111\u01b0\u1ee3c t\u1ec7p video ({{path}}).",
        "video.captions.units":
            "ph\u00fat|gi\u1edd|ng\u00e0y|th\u00e1ng|n\u0103m|\u0111\u1ed3ng|\u0111|k|kg|g|ml|l|cm|mm|m|km|%|ng\u01b0\u1eddi|c\u00e1i|b\u00f3|h\u1ed9p|chai|su\u1ea5t|l\u1ea7n|tu\u1ea7n|vn\u0111|vnd",
        "video.brand.fallback": "C\u1eeda h\u00e0ng",
        "video.render.failed": "D\u1ef1ng video kh\u00f4ng th\u00e0nh c\u00f4ng: {{reason}}",
    },
    en: {
        "errors.VIDEO_PROJECT_NOT_FOUND": "This video was not found.",
        "errors.VIDEO_PROJECT_BUSY": "The video is being scripted or rendered, wait until it is done.",
        "errors.VIDEO_SPEC_INVALID": "The script cannot be rendered yet: {{reason}}",
        "errors.VIDEO_RENDER_REJECTED": "This video cannot be rendered: {{reason}}",
        "errors.VIDEO_STORAGE_FAILED": "The video file could not be stored ({{path}}).",
        "video.captions.units":
            "min|hour|day|month|year|vnd|d|k|kg|g|ml|l|cm|mm|m|km|%|people|piece|box|bottle|serving|time|week",
        "video.brand.fallback": "Shop",
        "video.render.failed": "The video render failed: {{reason}}",
    },
}
