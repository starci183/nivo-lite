import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the NIVO data ops codes, Vietnamese and English. */
export const NIVO_API_MESSAGES: MessageBundle = {
    vi: {
        "errors.NIVO_API_OPS_UNCOVERED": "C\u00f3 thao t\u00e1c d\u1eef li\u1ec7u ch\u01b0a \u0111\u01b0\u1ee3c t\u00ednh n\u0103ng n\u00e0o khai b\u00e1o: {{ops}}.",
        "errors.NIVO_API_OPS_DUPLICATED": "C\u00f3 thao t\u00e1c d\u1eef li\u1ec7u \u0111\u01b0\u1ee3c h\u01a1n m\u1ed9t t\u00ednh n\u0103ng khai b\u00e1o: {{ops}}.",
    },
    en: {
        "errors.NIVO_API_OPS_UNCOVERED": "Some data ops are declared by no feature: {{ops}}.",
        "errors.NIVO_API_OPS_DUPLICATED": "Some data ops are declared by more than one feature: {{ops}}.",
    },
}
