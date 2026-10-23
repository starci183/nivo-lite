import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the thread-work codes and the lines the agents write in a work thread, Vietnamese and English. */
export const THREAD_WORK_MESSAGES: MessageBundle = {
    vi: {
        "errors.THREAD_WORK_AGENT_NOT_FOUND": "Không tìm thấy agent đang hoạt động này.",
        "errors.THREAD_WORK_ACTION_NOT_OF_AGENT": "Việc này không thuộc phòng của agent.",
        "errors.THREAD_WORK_LEAD_NOT_FOUND": "Không tìm thấy khách hàng này.",
        "threadWork.ask": "Cần duyệt {{action}}: {{summary}}",
        "threadWork.askStep": "Xin duyệt {{action}}",
        "threadWork.missing": "Cần {{fields}} để {{action}}. Anh chị trả lời tin này bằng {{fields}} đúng.",
        "threadWork.missingStep": "Cần {{fields}}",
        "threadWork.handoff": "{{done}} Nhờ làm tiếp: {{next}}.",
        "threadWork.handoffStep": "Chuyển {{next}}",
        "threadWork.nextSummary": "{{next}} cho {{customer}}",
        "threadWork.confirmation": "Đã xác nhận với {{customer}}: {{done}}",
        "threadWork.doneStep": "{{action}} xong",
        "threadWork.stopped": "Không làm tiếp được {{action}}: {{reason}}",
    },
    en: {
        "errors.THREAD_WORK_AGENT_NOT_FOUND": "That active agent was not found.",
        "errors.THREAD_WORK_ACTION_NOT_OF_AGENT": "That action does not belong to the department of the agent.",
        "errors.THREAD_WORK_LEAD_NOT_FOUND": "That customer was not found.",
        "threadWork.ask": "Approval needed for {{action}}: {{summary}}",
        "threadWork.askStep": "Ask to approve {{action}}",
        "threadWork.missing": "{{action}} needs {{fields}}. Please reply to this message with the right {{fields}}.",
        "threadWork.missingStep": "Needs {{fields}}",
        "threadWork.handoff": "{{done}} Please go on with: {{next}}.",
        "threadWork.handoffStep": "Hand over {{next}}",
        "threadWork.nextSummary": "{{next}} for {{customer}}",
        "threadWork.confirmation": "Confirmed with {{customer}}: {{done}}",
        "threadWork.doneStep": "{{action}} done",
        "threadWork.stopped": "Cannot go on with {{action}}: {{reason}}",
    },
}
