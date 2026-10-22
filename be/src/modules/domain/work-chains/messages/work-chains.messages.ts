import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the work-chains codes and the texts the capability writes into the workspace. */
export const WORK_CHAINS_MESSAGES: MessageBundle = {
    vi: {
        "errors.WORK_CHAINS_THREAD_NOT_FOUND": "Không tìm thấy luồng việc này.",
        "errors.WORK_CHAINS_NOT_STORED": "Không lưu được bước này.",
        "chain.stopped.limit": "Chuỗi đã chạy {{max}} bước tự động nên dừng lại và chuyển về người phụ trách.",
        "chain.stopped.loop":
            "Hai agent cứ chuyền cùng một việc cho nhau nên chuỗi dừng lại và chuyển về người phụ trách.",
        "chain.approval.approved": "{{name}} đã duyệt: {{action}}",
        "chain.approval.rejected": "{{name}} đã từ chối: {{action}}",
        "chain.approval.expired": "Hết hạn chờ duyệt: {{action}}",
    },
    en: {
        "errors.WORK_CHAINS_THREAD_NOT_FOUND": "That work thread was not found.",
        "errors.WORK_CHAINS_NOT_STORED": "The step could not be stored.",
        "chain.stopped.limit": "The chain ran {{max}} automatic steps, so it stopped and went back to the owner.",
        "chain.stopped.loop":
            "Two agents kept handing the same work to each other, so the chain stopped and went back to the owner.",
        "chain.approval.approved": "{{name}} approved: {{action}}",
        "chain.approval.rejected": "{{name}} rejected: {{action}}",
        "chain.approval.expired": "Approval timed out: {{action}}",
    },
}
