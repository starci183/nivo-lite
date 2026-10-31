import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-work codes, Vietnamese and English. */
export const AGENT_WORK_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_WORK_RESULT_REJECTED": "Hệ thống chưa đọc được kết quả của lượt làm việc.",
        "errors.AGENT_WORK_AGENT_NOT_FOUND": "Không tìm thấy agent này.",
        "errors.AGENT_WORK_GOAL_NOT_FOUND": "Không tìm thấy mục tiêu này.",
        "errors.AGENT_WORK_TASK_NOT_FOUND": "Không tìm thấy việc này.",
        "errors.AGENT_WORK_TRIGGER_NOT_FOUND": "Không tìm thấy lịch này.",
        "errors.AGENT_WORK_TOO_MANY_TRIGGERS": "Một agent có tối đa {{max}} lịch.",
        "errors.AGENT_WORK_TRIGGER_SHAPE_INVALID": "Lịch cần chọn giờ chạy hoặc sự kiện.",
        "errors.AGENT_WORK_TIME_INVALID": "Giờ phải có dạng HH:MM.",
        "errors.AGENT_WORK_HANDLER_DUPLICATE": "Nguồn {{source}} đã có bộ xử lý.",
    },
    en: {
        "errors.AGENT_WORK_RESULT_REJECTED": "The result of the work turn could not be read.",
        "errors.AGENT_WORK_AGENT_NOT_FOUND": "That agent was not found.",
        "errors.AGENT_WORK_GOAL_NOT_FOUND": "That goal was not found.",
        "errors.AGENT_WORK_TASK_NOT_FOUND": "That task was not found.",
        "errors.AGENT_WORK_TRIGGER_NOT_FOUND": "That schedule was not found.",
        "errors.AGENT_WORK_TOO_MANY_TRIGGERS": "An agent can have at most {{max}} schedules.",
        "errors.AGENT_WORK_TRIGGER_SHAPE_INVALID": "A schedule needs a time to run or an event.",
        "errors.AGENT_WORK_TIME_INVALID": "The time must look like HH:MM.",
        "errors.AGENT_WORK_HANDLER_DUPLICATE": "The source {{source}} already has a handler.",
    },
}
