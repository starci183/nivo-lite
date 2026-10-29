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
        "errors.WORKSPACE_MEMBERS_MEMBER_NOT_FOUND": "Kh\u00f4ng t\u00ecm th\u1ea5y th\u00e0nh vi\u00ean n\u00e0y.",
        "errors.WORKSPACE_MEMBERS_CHANGE_NOT_ALLOWED":
            "B\u1ea1n kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e9p thay \u0111\u1ed5i th\u00e0nh vi\u00ean n\u00e0y.",
        "errors.WORKSPACE_MEMBERS_SELF_FORBIDDEN":
            "B\u1ea1n kh\u00f4ng th\u1ec3 th\u1ef1c hi\u1ec7n thao t\u00e1c n\u00e0y v\u1edbi ch\u00ednh t\u00e0i kho\u1ea3n c\u1ee7a m\u00ecnh.",
        "errors.WORKSPACE_MEMBERS_LAST_OWNER":
            "Kh\u00f4ng gian l\u00e0m vi\u1ec7c c\u1ea7n \u00edt nh\u1ea5t m\u1ed9t ch\u1ee7 s\u1edf h\u1eefu \u0111ang ho\u1ea1t \u0111\u1ed9ng.",
        "errors.WORKSPACE_MEMBERS_CURRENT_SESSION":
            "\u0110\u00e2y l\u00e0 thi\u1ebft b\u1ecb b\u1ea1n \u0111ang d\u00f9ng; h\u00e3y \u0111\u0103ng xu\u1ea5t b\u00ecnh th\u01b0\u1eddng.",
        "errors.WORKSPACE_MEMBERS_ROLE_INVALID": "Vai trò không hợp lệ.",
        "errors.WORKSPACE_MEMBERS_SESSION_NOT_FOUND":
            "Kh\u00f4ng t\u00ecm th\u1ea5y phi\u00ean \u0111\u0103ng nh\u1eadp n\u00e0y.",
    },
    en: {
        "errors.WORKSPACE_MEMBERS_WORKSPACE_REQUIRED": "The request names no workspace.",
        "errors.WORKSPACE_MEMBERS_NOT_MEMBER": "You do not belong to this workspace.",
        "errors.WORKSPACE_MEMBERS_ROLE_FORBIDDEN": "Your role does not allow this.",
        "errors.WORKSPACE_MEMBERS_MEMBER_NOT_FOUND": "That member is not in this workspace.",
        "errors.WORKSPACE_MEMBERS_CHANGE_NOT_ALLOWED": "You may not change this member.",
        "errors.WORKSPACE_MEMBERS_SELF_FORBIDDEN": "You cannot do this to your own account.",
        "errors.WORKSPACE_MEMBERS_LAST_OWNER": "A workspace needs at least one active owner.",
        "errors.WORKSPACE_MEMBERS_CURRENT_SESSION": "This is the device you are using; sign out the usual way.",
        "errors.WORKSPACE_MEMBERS_SESSION_NOT_FOUND": "That session was not found.",
        "errors.WORKSPACE_MEMBERS_ROLE_INVALID": "That role is not a workspace role.",
    },
}
