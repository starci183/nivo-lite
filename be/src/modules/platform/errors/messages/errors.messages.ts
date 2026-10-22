import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the errors capability codes, Vietnamese and English. */
export const ERRORS_MESSAGES: MessageBundle = {
    vi: {
        "errors.ERRORS_INTERNAL": "\u0110\u00e3 x\u1ea3y ra l\u1ed7i kh\u00f4ng mong mu\u1ed1n.",
        "errors.ERRORS_OPERATION_INVALID": "Y\u00eau c\u1ea7u kh\u00f4ng h\u1ee3p l\u1ec7.",
        "errors.ERRORS_ROUTE_NOT_FOUND":
            "Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u01b0\u1eddng d\u1eabn \u0111\u01b0\u1ee3c y\u00eau c\u1ea7u.",
    },
    en: {
        "errors.ERRORS_INTERNAL": "An unexpected error occurred.",
        "errors.ERRORS_OPERATION_INVALID": "The request is malformed.",
        "errors.ERRORS_ROUTE_NOT_FOUND": "No route matches the request.",
    },
}
