import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the office rooms codes, Vietnamese and English. */
export const OFFICE_ROOMS_MESSAGES: MessageBundle = {
    vi: {
        "errors.OFFICE_ROOMS_ROOM_INVALID": "Không có phòng {{room}}.",
        "errors.OFFICE_ROOMS_CONVERSATION_INVALID": "Không có hội thoại {{id}}.",
        "officeRooms.openedTitle": "Đã mở các phòng ban",
        "officeRooms.openedBody": "Trao đổi theo từng phòng: {{names}}. Office vẫn hiện mọi cập nhật.",
    },
    en: {
        "errors.OFFICE_ROOMS_ROOM_INVALID": "There is no room {{room}}.",
        "errors.OFFICE_ROOMS_CONVERSATION_INVALID": "There is no conversation {{id}}.",
        "officeRooms.openedTitle": "Department rooms are open",
        "officeRooms.openedBody": "Talk room by room: {{names}}. The Office room still shows every update.",
    },
}
