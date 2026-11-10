import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-runs codes, Vietnamese and English. */
export const AGENT_RUNS_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_RUNS_RESULT_REJECTED": "Hệ thống chưa đọc được kết quả của bước làm việc.",
        "errors.AGENT_RUNS_RUN_CONTENDED": "Lượt làm việc đang được cập nhật, sẽ thử lại.",
    },
    en: {
        "errors.AGENT_RUNS_RESULT_REJECTED": "The result of the work step could not be read.",
        "errors.AGENT_RUNS_RUN_CONTENDED": "The run is being updated; it will be tried again.",
    },
}
