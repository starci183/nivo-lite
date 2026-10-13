import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the accounts codes, Vietnamese and English. */
export const ACCOUNTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.ACCOUNTS_CURRENT_SESSION":
            "\u0110\u00e2y l\u00e0 thi\u1ebft b\u1ecb b\u1ea1n \u0111ang d\u00f9ng; h\u00e3y \u0111\u0103ng xu\u1ea5t b\u00ecnh th\u01b0\u1eddng.",
        "errors.ACCOUNTS_SESSION_NOT_FOUND":
            "Kh\u00f4ng t\u00ecm th\u1ea5y phi\u00ean \u0111\u0103ng nh\u1eadp n\u00e0y.",
    },
    en: {
        "errors.ACCOUNTS_CURRENT_SESSION": "This is the device you are using; sign out the usual way.",
        "errors.ACCOUNTS_SESSION_NOT_FOUND": "That session was not found.",
    },
}
