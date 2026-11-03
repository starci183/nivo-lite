import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-runs codes, Vietnamese and English. */
export const AGENT_RUNS_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_RUNS_PLAN_CONFLICT":
            "Lượt làm việc đã gắn với kế hoạch khác. Vui lòng kiểm tra trước khi tiếp tục.",
        "errors.AGENT_RUNS_RESULT_REJECTED": "Hệ thống chưa đọc được kết quả của bước làm việc.",
        "errors.AGENT_RUNS_HANDLER_DUPLICATE": "Bước loại {{kind}} đã có bộ xử lý.",
        "errors.AGENT_RUNS_RUN_NOT_FOUND": "Lượt làm việc này chưa có tiến trình.",
        "errors.AGENT_RUNS_STEP_FAILED": "Bước làm việc chưa hoàn tất: {{code}}.",
        "errors.AGENT_RUNS_JOB_PAYLOAD_INVALID": "Việc cần chạy không nêu tiến trình nào.",
    },
    en: {
        "errors.AGENT_RUNS_PLAN_CONFLICT": "This run is bound to a different plan. Review it before continuing.",
        "errors.AGENT_RUNS_RESULT_REJECTED": "The result of the work step could not be read.",
        "errors.AGENT_RUNS_HANDLER_DUPLICATE": "The step kind {{kind}} already has a handler.",
        "errors.AGENT_RUNS_RUN_NOT_FOUND": "That work turn has no run yet.",
        "errors.AGENT_RUNS_STEP_FAILED": "The work step did not finish: {{code}}.",
        "errors.AGENT_RUNS_JOB_PAYLOAD_INVALID": "The job names no run.",
    },
}
