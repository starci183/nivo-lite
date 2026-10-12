import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the workspace-members codes, Vietnamese and English. */
export const WORKSPACE_MEMBERS_MESSAGES: MessageBundle = {
    vi: {
        "errors.WORKSPACE_MEMBERS_WORKSPACE_REQUIRED":
            "Thi\u1ebfu kh\u00f4ng gian l\u00e0m vi\u1ec7c trong y\u00eau c\u1ea7u.",
        "errors.WORKSPACE_MEMBERS_NOT_MEMBER":
            "B\u1ea1n kh\u00f4ng thu\u1ed9c kh\u00f4ng gian l\u00e0m vi\u1ec7c n\u00e0y.",
        "errors.WORKSPACE_MEMBERS_ROLE_FORBIDDEN":
            "Vai tr\u00f2 c\u1ee7a b\u1ea1n kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e9p th\u1ef1c hi\u1ec7n thao t\u00e1c n\u00e0y.",
    },
    en: {
        "errors.WORKSPACE_MEMBERS_WORKSPACE_REQUIRED": "The request names no workspace.",
        "errors.WORKSPACE_MEMBERS_NOT_MEMBER": "You do not belong to this workspace.",
        "errors.WORKSPACE_MEMBERS_ROLE_FORBIDDEN": "Your role does not allow this.",
    },
}
