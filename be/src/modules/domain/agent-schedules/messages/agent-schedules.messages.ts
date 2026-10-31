import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-schedules codes, Vietnamese and English. */
export const AGENT_SCHEDULES_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_SCHEDULES_DRAIN_PAYLOAD_INVALID": "Lượt chạy thiếu agent hoặc phạm vi cần xử lý.",
        "errors.AGENT_SCHEDULES_FIRE_PAYLOAD_INVALID": "Lượt chạy theo lịch thiếu lịch hoặc mốc giờ.",
    },
    en: {
        "errors.AGENT_SCHEDULES_DRAIN_PAYLOAD_INVALID": "The run names no agent or scope to work on.",
        "errors.AGENT_SCHEDULES_FIRE_PAYLOAD_INVALID": "A scheduled run carries no schedule or time slot.",
    },
}
