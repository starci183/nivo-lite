import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the provider-registry codes, Vietnamese and English. */
export const PROVIDER_REGISTRY_MESSAGES: MessageBundle = {
    vi: {
        "errors.PROVIDER_REGISTRY_LEDGER_CONNECTION_REFUSED":
            "{{provider}} từ chối kết nối sổ cái của workspace; bạn cần kết nối lại.",
    },
    en: {
        "errors.PROVIDER_REGISTRY_LEDGER_CONNECTION_REFUSED":
            "{{provider}} refused the workspace's ledger connection; the owner has to connect it again.",
    },
}
