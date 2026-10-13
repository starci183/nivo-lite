import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the connection-grants codes, Vietnamese and English. */
export const CONNECTION_GRANTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONNECTION_GRANTS_PAIR_REFUSED": "{{agent}} kh\u00f4ng d\u00f9ng \u0111\u01b0\u1ee3c {{connection}}: lo\u1ea1i k\u1ebft n\u1ed1i n\u00e0y kh\u00f4ng d\u00e0nh cho agent n\u00e0y.",
        "errors.CONNECTION_GRANTS_CONNECTION_DISCONNECTED": "{{connection}} \u0111\u00e3 ng\u1eaft k\u1ebft n\u1ed1i. H\u00e3y k\u1ebft n\u1ed1i l\u1ea1i tr\u01b0\u1edbc khi c\u1ea5p quy\u1ec1n cho agent.",
    },
    en: {
        "errors.CONNECTION_GRANTS_PAIR_REFUSED": "{{agent}} cannot use {{connection}}: that kind of connection is not for this agent.",
        "errors.CONNECTION_GRANTS_CONNECTION_DISCONNECTED": "{{connection}} is disconnected. Reconnect it before giving an agent access.",
    },
}
