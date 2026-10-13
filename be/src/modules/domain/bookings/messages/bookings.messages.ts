import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the booking codes, Vietnamese and English. */
export const BOOKINGS_MESSAGES: MessageBundle = {
    vi: {
        "errors.BOOKINGS_PAGE_NOT_FOUND": "Trang đặt lịch này không còn hoạt động.",
        "errors.BOOKINGS_NOT_FOUND": "Không tìm thấy lịch hẹn.",
        "errors.BOOKINGS_NOT_CHANGEABLE": "Lịch hẹn này không còn đổi được.",
        "errors.BOOKINGS_NOT_CREATED": "Chưa ghi được lịch hẹn, bạn thử lại nhé.",
    },
    en: {
        "errors.BOOKINGS_PAGE_NOT_FOUND": "This booking page is no longer available.",
        "errors.BOOKINGS_NOT_FOUND": "The booking was not found.",
        "errors.BOOKINGS_NOT_CHANGEABLE": "This booking can no longer be changed.",
        "errors.BOOKINGS_NOT_CREATED": "The booking could not be saved, please try again.",
    },
}
