import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the booking codes, Vietnamese and English. */
export const BOOKINGS_MESSAGES: MessageBundle = {
    vi: {
        "errors.BOOKINGS_PAGE_NOT_FOUND": "Trang đặt lịch này không còn hoạt động.",
        "errors.BOOKINGS_NOT_FOUND": "Không tìm thấy lịch hẹn.",
        "errors.BOOKINGS_NOT_CHANGEABLE": "Lịch hẹn này không còn đổi được.",
        "errors.BOOKINGS_NOT_CREATED": "Chưa ghi được lịch hẹn, bạn thử lại nhé.",
        "bookings.handoff.body": "Dịch vụ {{service}}",
        "bookings.evidence.actor": "Đặt lịch hẹn",
        "bookings.evidence.done": "Xong lịch hẹn: {{service}} · {{customer}}",
        "bookings.evidence.no_show": "Khách không đến: {{service}} · {{customer}}",
        "bookings.evidence.cancelled": "Đã hủy lịch hẹn: {{service}} · {{customer}}",
        "bookings.notice.confirmed": "Lịch {{service}} của bạn lúc {{when}} đã được xác nhận. Hẹn gặp bạn!",
        "bookings.notice.moved": "Lịch {{service}} của bạn đã được dời sang {{when}}.",
        "bookings.notice.cancelled": "Lịch {{service}} lúc {{when}} đã được hủy.",
    },
    en: {
        "errors.BOOKINGS_PAGE_NOT_FOUND": "This booking page is no longer available.",
        "errors.BOOKINGS_NOT_FOUND": "The booking was not found.",
        "errors.BOOKINGS_NOT_CHANGEABLE": "This booking can no longer be changed.",
        "errors.BOOKINGS_NOT_CREATED": "The booking could not be saved, please try again.",
        "bookings.handoff.body": "Service {{service}}",
        "bookings.evidence.actor": "Booking",
        "bookings.evidence.done": "Appointment finished: {{service}} · {{customer}}",
        "bookings.evidence.no_show": "Customer did not come: {{service}} · {{customer}}",
        "bookings.evidence.cancelled": "Appointment cancelled: {{service}} · {{customer}}",
        "bookings.notice.confirmed": "Your {{service}} appointment on {{when}} is confirmed. See you then!",
        "bookings.notice.moved": "Your {{service}} appointment was moved to {{when}}.",
        "bookings.notice.cancelled": "Your {{service}} appointment on {{when}} was cancelled.",
    },
}
