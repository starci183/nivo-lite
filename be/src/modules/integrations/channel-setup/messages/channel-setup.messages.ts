import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the channel-setup codes, Vietnamese and English. */
export const CHANNEL_SETUP_MESSAGES: MessageBundle = {
    vi: {
        "errors.CHANNEL_SETUP_CREDENTIAL_REJECTED": "Nhà cung cấp không chấp nhận thông tin kết nối này.",
        "errors.CHANNEL_SETUP_UNREACHABLE": "Không kết nối được tới nhà cung cấp. Vui lòng thử lại.",
        "errors.CHANNEL_SETUP_REFUSED": "Nhà cung cấp từ chối yêu cầu.",
    },
    en: {
        "errors.CHANNEL_SETUP_CREDENTIAL_REJECTED": "The provider did not accept this credential.",
        "errors.CHANNEL_SETUP_UNREACHABLE": "Could not reach the provider. Please try again.",
        "errors.CHANNEL_SETUP_REFUSED": "The provider refused the request.",
    },
}
