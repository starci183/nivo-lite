import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the connections codes, Vietnamese and English. */
export const CONNECTIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONNECTIONS_FORBIDDEN": "B\u1ea1n kh\u00f4ng c\u00f3 quy\u1ec1n th\u1ef1c hi\u1ec7n thao t\u00e1c n\u00e0y. H\u00e3y nh\u1edd ch\u1ee7 s\u1edf h\u1eefu ho\u1eb7c qu\u1ea3n l\u00fd.",
        "errors.CONNECTIONS_NOT_FOUND": "K\u1ebft n\u1ed1i n\u00e0y kh\u00f4ng c\u00f2n t\u1ed3n t\u1ea1i.",
        "errors.CONNECTIONS_NAME_INVALID": "H\u00e3y \u0111\u1eb7t t\u00ean cho k\u1ebft n\u1ed1i (\u00edt nh\u1ea5t 2 k\u00fd t\u1ef1).",
        "errors.CONNECTIONS_STILL_CONNECTED": "H\u00e3y ng\u1eaft k\u1ebft n\u1ed1i tr\u01b0\u1edbc.",
        "errors.CONNECTIONS_KEY_INVALID": "Kh\u00f3a m\u00e3 h\u00f3a th\u00f4ng tin k\u1ebft n\u1ed1i c\u1ee7a m\u00e1y ch\u1ee7 ch\u01b0a \u0111\u01b0\u1ee3c c\u1ea5u h\u00ecnh \u0111\u00fang.",
        "errors.CONNECTIONS_CONNECTOR_NOT_FOUND": "Kh\u00f4ng t\u00ecm th\u1ea5y connector n\u00e0y.",
        "errors.CONNECTIONS_COMMAND_INVALID": "Yêu cầu không hợp lệ.",
    },
    en: {
        "errors.CONNECTIONS_FORBIDDEN": "You do not have permission to do this. Ask an owner or manager.",
        "errors.CONNECTIONS_NOT_FOUND": "This connection no longer exists.",
        "errors.CONNECTIONS_NAME_INVALID": "Give the connection a name (at least 2 characters).",
        "errors.CONNECTIONS_STILL_CONNECTED": "Disconnect it first.",
        "errors.CONNECTIONS_KEY_INVALID": "The server connection encryption key is not configured correctly.",
        "errors.CONNECTIONS_CONNECTOR_NOT_FOUND": "This connector was not found.",
        "errors.CONNECTIONS_COMMAND_INVALID": "This request is not valid.",
    },
}
