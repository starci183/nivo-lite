import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the credits codes, Vietnamese and English. */
export const CREDITS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CREDITS_PACK_NOT_FOUND": "G\u00f3i credit n\u00e0y kh\u00f4ng c\u00f2n b\u00e1n.",
        "errors.CREDITS_WORKSPACE_NOT_ACTIVE":
            "Workspace ch\u01b0a ho\u1ea1t \u0111\u1ed9ng n\u00ean ch\u01b0a th\u1ec3 mua th\u00eam.",
        "errors.CREDITS_PLAN_NOT_FOUND":
            "Kh\u00f4ng t\u00ecm th\u1ea5y g\u00f3i hi\u1ec7n t\u1ea1i c\u1ee7a workspace.",
        "errors.CREDITS_NOT_UPGRADE":
            "Ch\u1ec9 n\u00e2ng c\u1ea5p \u0111\u01b0\u1ee3c l\u00ean m\u1ed9t g\u00f3i cao h\u01a1n.",
        "errors.CREDITS_RENEW_FIRST":
            "G\u00f3i \u0111\u00e3 h\u1ebft h\u1ea1n, h\u00e3y gia h\u1ea1n tr\u01b0\u1edbc khi n\u00e2ng c\u1ea5p.",
        "errors.CREDITS_ZERO_AMOUNT":
            "Kh\u00f4ng c\u00f3 kho\u1ea3n n\u00e0o c\u1ea7n thanh to\u00e1n, h\u00e3y li\u00ean h\u1ec7 NIVO \u0111\u1ec3 chuy\u1ec3n g\u00f3i.",
    },
    en: {
        "errors.CREDITS_PACK_NOT_FOUND": "This credit pack is no longer on sale.",
        "errors.CREDITS_WORKSPACE_NOT_ACTIVE": "The workspace is not active, so it cannot buy more yet.",
        "errors.CREDITS_PLAN_NOT_FOUND": "The current plan of the workspace was not found.",
        "errors.CREDITS_NOT_UPGRADE": "You can only upgrade to a higher plan.",
        "errors.CREDITS_RENEW_FIRST": "The plan has expired, please renew before upgrading.",
        "errors.CREDITS_ZERO_AMOUNT": "Nothing is due, please contact NIVO to switch the plan.",
    },
}
