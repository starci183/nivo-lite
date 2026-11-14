import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the Google Calendar codes, Vietnamese and English. */
export const GOOGLE_CALENDAR_MESSAGES: MessageBundle = {
    vi: {
        "errors.GOOGLE_CALENDAR_UNREACHABLE": "Không liên lạc được Google Calendar.",
        "errors.GOOGLE_CALENDAR_AUTH_FAILED": "Google Calendar không chấp nhận quyền của kết nối Google.",
        "errors.GOOGLE_CALENDAR_RATE_LIMITED": "Google Calendar yêu cầu chậm lại, thử lại sau.",
        "errors.GOOGLE_CALENDAR_NOT_FOUND": "Google Calendar không tìm thấy lịch hoặc sự kiện được hỏi.",
        "errors.GOOGLE_CALENDAR_GONE": "Sự kiện đã bị xóa khỏi Google Calendar.",
        "errors.GOOGLE_CALENDAR_REJECTED": "Google Calendar từ chối yêu cầu.",
        "errors.GOOGLE_CALENDAR_FAILED": "Google Calendar gặp lỗi khi xử lý yêu cầu.",
        "errors.GOOGLE_CALENDAR_MALFORMED": "Google Calendar trả lời một nội dung không đọc được.",
    },
    en: {
        "errors.GOOGLE_CALENDAR_UNREACHABLE": "Google Calendar could not be reached.",
        "errors.GOOGLE_CALENDAR_AUTH_FAILED": "Google Calendar did not accept the access of the Google connection.",
        "errors.GOOGLE_CALENDAR_RATE_LIMITED": "Google Calendar asked to slow down; try again later.",
        "errors.GOOGLE_CALENDAR_NOT_FOUND": "Google Calendar did not find the calendar or event asked.",
        "errors.GOOGLE_CALENDAR_GONE": "The event was already deleted from Google Calendar.",
        "errors.GOOGLE_CALENDAR_REJECTED": "Google Calendar refused the request.",
        "errors.GOOGLE_CALENDAR_FAILED": "Google Calendar failed while handling the request.",
        "errors.GOOGLE_CALENDAR_MALFORMED": "Google Calendar answered something unreadable.",
    },
}
