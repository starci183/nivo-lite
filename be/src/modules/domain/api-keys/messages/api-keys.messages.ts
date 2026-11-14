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
        "errors.API_KEYS_NOT_MANAGER":
            "Ch\u1ec9 ch\u1ee7 shop ho\u1eb7c qu\u1ea3n l\u00fd m\u1edbi qu\u1ea3n l\u00fd \u0111\u01b0\u1ee3c kho\u00e1 API.",
        "errors.API_KEYS_LIMIT_REACHED":
            "\u0110\u00e3 c\u00f3 {{limit}} kho\u00e1 \u0111ang d\u00f9ng. H\u00e3y thu h\u1ed3i b\u1edbt kho\u00e1 kh\u00f4ng d\u00f9ng.",
        "errors.API_KEYS_NAME_TOO_SHORT":
            "\u0110\u1eb7t t\u00ean cho kho\u00e1 (\u00edt nh\u1ea5t 2 k\u00fd t\u1ef1), v\u00ed d\u1ee5: n8n b\u00e1n h\u00e0ng.",
        "errors.API_KEYS_NOT_FOUND":
            "Kh\u00f4ng t\u00ecm th\u1ea5y kho\u00e1 n\u00e0y, ho\u1eb7c kho\u00e1 \u0111\u00e3 \u0111\u01b0\u1ee3c thu h\u1ed3i.",
        "errors.API_KEYS_NOT_CREATED":
            "Ch\u01b0a t\u1ea1o \u0111\u01b0\u1ee3c kho\u00e1 API. Th\u1eed l\u1ea1i sau \u00edt ph\u00fat.",
        "errors.API_KEYS_AGENT_NOT_FOUND":
            "Kh\u00f4ng t\u00ecm th\u1ea5y tr\u1ee3 l\u00fd AI n\u00e0y trong workspace.",
        "errors.API_KEYS_HOLDER_GONE":
            "Ng\u01b0\u1eddi t\u1ea1o kho\u00e1 n\u00e0y kh\u00f4ng c\u00f2n trong workspace, n\u00ean kho\u00e1 kh\u00f4ng d\u00f9ng \u0111\u01b0\u1ee3c.",
        "errors.API_KEYS_HOLDER_NOT_MANAGER":
            "Người giữ khoá này không còn là chủ sở hữu hay quản lý, nên khoá tạm ngưng.",
        "errors.API_KEYS_NOT_MEMBER":
            "B\u1ea1n kh\u00f4ng c\u00f2n l\u00e0 th\u00e0nh vi\u00ean c\u1ee7a workspace n\u00e0y.",
        "errors.API_KEYS_AGENT_MISSING":
            "Kho\u00e1 API n\u00e0y c\u1ea7n g\u1eafn v\u1edbi m\u1ed9t tr\u1ee3 l\u00fd AI, ho\u1eb7c workspace c\u1ea7n c\u00f3 s\u1eb5n tr\u1ee3 l\u00fd ti\u1ebfp kh\u00e1ch \u0111\u1ec3 nh\u1eadn cu\u1ed9c tr\u00f2 chuy\u1ec7n n\u00e0y.",
    },
    en: {
        "errors.API_KEYS_UNAUTHORIZED": "Missing or invalid API key. Send the header Authorization: Bearer <key>.",
        "errors.API_KEYS_REVOKED": "This API key was revoked.",
        "errors.API_KEYS_RATE_LIMITED":
            "Too many requests (at most {{limit}} a minute). Retry in {{retryAfter}} seconds.",
        "errors.API_KEYS_SCOPE_MISSING": 'This key does not have the "{{scope}}" scope.',
        "errors.API_KEYS_NOT_MANAGER": "Only the owner or a manager can manage API keys.",
        "errors.API_KEYS_LIMIT_REACHED": "{{limit}} keys are already in use. Revoke the ones you no longer need.",
        "errors.API_KEYS_NAME_TOO_SHORT": "Name the key (at least 2 characters), for example: n8n sales.",
        "errors.API_KEYS_NOT_FOUND": "This key was not found, or it was already revoked.",
        "errors.API_KEYS_NOT_CREATED": "The API key could not be created. Try again in a few minutes.",
        "errors.API_KEYS_AGENT_NOT_FOUND": "This AI agent was not found in the workspace.",
        "errors.API_KEYS_HOLDER_GONE":
            "The member who created this key is no longer in the workspace, so the key does not work.",
        "errors.API_KEYS_HOLDER_NOT_MANAGER":
            "The member holding this key is no longer an owner or manager, so the key is suspended.",
        "errors.API_KEYS_NOT_MEMBER": "You are no longer a member of this workspace.",
        "errors.API_KEYS_AGENT_MISSING":
            "This API key needs an AI agent, or the workspace needs an installed front-door agent, to own this conversation.",
    },
}
