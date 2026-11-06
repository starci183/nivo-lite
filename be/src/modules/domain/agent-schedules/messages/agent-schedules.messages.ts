import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-schedules codes, Vietnamese and English. */
export const AGENT_SCHEDULES_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_SCHEDULES_DRAIN_PAYLOAD_INVALID": "Lượt chạy thiếu agent hoặc phạm vi cần xử lý.",
        "errors.AGENT_SCHEDULES_FIRE_PAYLOAD_INVALID": "Lượt chạy theo lịch thiếu lịch hoặc mốc giờ.",
        "agentSchedules.wakeDead":
            "Một việc theo lịch của mình không chạy được sau nhiều lần thử nên mình đã dừng lại. Bạn xem giúp mình nhé.",
    },
    en: {
        "errors.AGENT_SCHEDULES_DRAIN_PAYLOAD_INVALID": "The run names no agent or scope to work on.",
        "errors.AGENT_SCHEDULES_FIRE_PAYLOAD_INVALID": "A scheduled run carries no schedule or time slot.",
        "agentSchedules.wakeDead":
            "One of my scheduled jobs failed after several tries, so I stopped. Please take a look.",
    },
}
