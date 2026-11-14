import type { MessageBundle } from "@modules/platform/i18n"

/** The words of the setup's gap proposals (the intent registry and its prompt words are gone with the authority actions, 2026-11-13). */
export const INTENT_CONTRACTS_MESSAGES: MessageBundle = {
    vi: {
        "intentContracts.setup.unheldTopic": "Quy tắc về {{amount}} mà phần thiết lập nêu ra còn sơ đồ thì chưa giữ",
    },
    en: {
        "intentContracts.setup.unheldTopic":
            "A rule about {{amount}} that the setup states and the graph does not hold",
    },
}
