import type { MessageBundle } from "@modules/platform/i18n"

/** Localized simulator refusal text and the channel labels retained on lead proposals. */
export const INBOX_SIMULATION_MESSAGES: MessageBundle = {
    vi: {
        "errors.INBOX_SIMULATION_INVALID": "Dữ liệu đầu vào mô phỏng không hợp lệ.",
        "errors.INBOX_SIMULATION_NOT_FOUND": "Không tìm thấy đầu vào mô phỏng trong không gian làm việc này.",
        "errors.INBOX_SIMULATION_PENDING": "Đầu vào mô phỏng vẫn đang được xử lý.",
        "errors.INBOX_SIMULATION_FAILED": "Không thể xử lý đầu vào mô phỏng.",
        "inboxSimulation.channel.zalo": "Zalo",
        "inboxSimulation.channel.facebook": "Facebook",
        "inboxSimulation.channel.email": "Email",
        "inboxSimulation.channel.phone": "Điện thoại",
        "inboxSimulation.channel.bank": "Ngân hàng",
        "inboxSimulation.channel.manual": "Nhập tay",
    },
    en: {
        "errors.INBOX_SIMULATION_INVALID": "The simulated input is invalid.",
        "errors.INBOX_SIMULATION_NOT_FOUND": "The simulated input was not found in this workspace.",
        "errors.INBOX_SIMULATION_PENDING": "The simulated input is still being processed.",
        "errors.INBOX_SIMULATION_FAILED": "The simulated input could not be processed.",
        "inboxSimulation.channel.zalo": "Zalo",
        "inboxSimulation.channel.facebook": "Facebook",
        "inboxSimulation.channel.email": "Email",
        "inboxSimulation.channel.phone": "Phone",
        "inboxSimulation.channel.bank": "Bank",
        "inboxSimulation.channel.manual": "Manual",
    },
}
