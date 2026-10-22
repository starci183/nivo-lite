import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the work-threads codes, Vietnamese and English. */
export const WORK_THREADS_MESSAGES: MessageBundle = {
    vi: {
        "errors.WORK_THREADS_THREAD_NOT_FOUND": "Không tìm thấy luồng việc này.",
        "errors.WORK_THREADS_LEAD_NOT_FOUND": "Không tìm thấy khách hàng này.",
        "errors.WORK_THREADS_ORDER_NOT_FOUND": "Không tìm thấy đơn hàng này.",
        "errors.WORK_THREADS_NOT_STORED": "Không lưu được luồng việc.",
    },
    en: {
        "errors.WORK_THREADS_THREAD_NOT_FOUND": "That work thread was not found.",
        "errors.WORK_THREADS_LEAD_NOT_FOUND": "That customer was not found.",
        "errors.WORK_THREADS_ORDER_NOT_FOUND": "That order was not found.",
        "errors.WORK_THREADS_NOT_STORED": "The work thread could not be stored.",
    },
}
