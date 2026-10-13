import { DATA_SOURCES_MESSAGES } from "@modules/integrations/data-sources"
import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the data-hub codes and of the data-sources codes it surfaces, Vietnamese and English. */
export const DATA_HUB_MESSAGES: MessageBundle = {
    vi: {
        ...DATA_SOURCES_MESSAGES.vi,
        "errors.DATA_HUB_NOT_FOUND": "Không tìm thấy kết nối dữ liệu này.",
        "errors.DATA_HUB_INVALID": "{{detail}}",
        "errors.DATA_HUB_SCHEDULE_INVALID": "Chu kỳ phải từ 5 phút đến 7 ngày.",
        "errors.DATA_HUB_SYNC_FAILED": "Đồng bộ không thành công.",
    },
    en: {
        ...DATA_SOURCES_MESSAGES.en,
        "errors.DATA_HUB_NOT_FOUND": "This data connection was not found.",
        "errors.DATA_HUB_INVALID": "{{detail}}",
        "errors.DATA_HUB_SCHEDULE_INVALID": "The schedule must be between 5 minutes and 7 days.",
        "errors.DATA_HUB_SYNC_FAILED": "The sync did not succeed.",
    },
}
