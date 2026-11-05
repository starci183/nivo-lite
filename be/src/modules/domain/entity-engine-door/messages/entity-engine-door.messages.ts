import type { MessageBundle } from "@modules/platform/i18n"

/** The localized refusal lines of the door provider. */
export const ENTITY_ENGINE_DOOR_MESSAGES: MessageBundle = {
    vi: {
        "errors.ENTITY_ENGINE_DOOR_IN_SCOPE": "Không thể gọi dịch vụ bên ngoài khi đang giữ một giao dịch dữ liệu.",
    },
    en: {
        "errors.ENTITY_ENGINE_DOOR_IN_SCOPE": "An outside service cannot be called while a data transaction is open.",
    },
}
