import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the api-keys codes, Vietnamese and English. */
export const API_KEYS_MESSAGES: MessageBundle = {
    vi: {
        "errors.API_KEYS_UNAUTHORIZED":
            "Thi\u1ebfu ho\u1eb7c sai kho\u00e1 API. G\u1eedi header Authorization: Bearer <kho\u00e1>.",
        "errors.API_KEYS_REVOKED": "Kho\u00e1 API n\u00e0y \u0111\u00e3 b\u1ecb thu h\u1ed3i.",
        "errors.API_KEYS_RATE_LIMITED":
            "Qu\u00e1 nhi\u1ec1u y\u00eau c\u1ea7u (t\u1ed1i \u0111a {{limit}}/ph\u00fat). Th\u1eed l\u1ea1i sau {{retryAfter}} gi\u00e2y.",
        "errors.API_KEYS_SCOPE_MISSING": 'Kho\u00e1 n\u00e0y kh\u00f4ng c\u00f3 quy\u1ec1n "{{scope}}".',
    },
    en: {
        "errors.API_KEYS_UNAUTHORIZED": "Missing or invalid API key. Send the header Authorization: Bearer <key>.",
        "errors.API_KEYS_REVOKED": "This API key was revoked.",
        "errors.API_KEYS_RATE_LIMITED":
            "Too many requests (at most {{limit}} a minute). Retry in {{retryAfter}} seconds.",
        "errors.API_KEYS_SCOPE_MISSING": 'This key does not have the "{{scope}}" scope.',
    },
}
