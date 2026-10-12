import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the workspace-invites codes, Vietnamese and English. */
export const WORKSPACE_INVITES_MESSAGES: MessageBundle = {
    vi: {
        "errors.WORKSPACE_INVITES_EMAIL_INVALID": "Email kh\u00f4ng h\u1ee3p l\u1ec7.",
        "errors.WORKSPACE_INVITES_ALREADY_MEMBER": "Ng\u01b0\u1eddi n\u00e0y \u0111\u00e3 l\u00e0 th\u00e0nh vi\u00ean.",
        "errors.WORKSPACE_INVITES_STAFF_TAKEN": "Nh\u00e2n vi\u00ean n\u00e0y \u0111\u00e3 g\u1eafn v\u1edbi m\u1ed9t t\u00e0i kho\u1ea3n ho\u1eb7c m\u1ed9t l\u1eddi m\u1eddi kh\u00e1c.",
        "errors.WORKSPACE_INVITES_NOT_FOUND": "Kh\u00f4ng t\u00ecm th\u1ea5y l\u1eddi m\u1eddi.",
        "errors.WORKSPACE_INVITES_INVALID": "Li\u00ean k\u1ebft m\u1eddi kh\u00f4ng h\u1ee3p l\u1ec7.",
        "errors.WORKSPACE_INVITES_REVOKED": "L\u1eddi m\u1eddi \u0111\u00e3 b\u1ecb thu h\u1ed3i.",
        "errors.WORKSPACE_INVITES_USED": "L\u1eddi m\u1eddi \u0111\u00e3 \u0111\u01b0\u1ee3c d\u00f9ng.",
        "errors.WORKSPACE_INVITES_EXPIRED": "L\u1eddi m\u1eddi \u0111\u00e3 h\u1ebft h\u1ea1n.",
        "errors.WORKSPACE_INVITES_EMAIL_MISMATCH": "L\u1eddi m\u1eddi n\u00e0y d\u00e0nh cho m\u1ed9t email kh\u00e1c.",
    },
    en: {
        "errors.WORKSPACE_INVITES_EMAIL_INVALID": "That email address is not valid.",
        "errors.WORKSPACE_INVITES_ALREADY_MEMBER": "This person is already a member.",
        "errors.WORKSPACE_INVITES_STAFF_TAKEN": "This staff member is already linked to an account or another invitation.",
        "errors.WORKSPACE_INVITES_NOT_FOUND": "The invitation was not found.",
        "errors.WORKSPACE_INVITES_INVALID": "This invitation link is not valid.",
        "errors.WORKSPACE_INVITES_REVOKED": "This invitation was revoked.",
        "errors.WORKSPACE_INVITES_USED": "This invitation was already used.",
        "errors.WORKSPACE_INVITES_EXPIRED": "This invitation has expired.",
        "errors.WORKSPACE_INVITES_EMAIL_MISMATCH": "This invitation is for a different email address.",
    },
}
