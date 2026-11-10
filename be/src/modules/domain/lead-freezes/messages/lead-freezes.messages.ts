import type { MessageBundle } from "@modules/platform/i18n"

/** The words of the freezes of customers: the owner's item, the outcome of an answer, and the refusals. */
export const LEAD_FREEZES_MESSAGES: MessageBundle = {
    vi: {
        "errors.LEAD_FREEZES_RECORD_UNREADABLE": "Hệ thống chưa đọc được trạng thái chờ của khách này.",
        "errors.LEAD_FREEZES_CONTENDED": "Trạng thái chờ của khách vừa thay đổi. Hãy thử lại.",
        "errors.LEAD_FREEZES_NOT_FOUND": "Khách này không còn chờ bạn xử lý lỗi.",
        "leadFreezes.item.title": "Khách {{name}} đang chờ bạn: lỗi ở bước {{step}}",
        "leadFreezes.item.unnamed": "chưa rõ tên",
        "leadFreezes.item.error": "Lỗi: {{summary}}.",
        "leadFreezes.item.failures": "Đã lỗi {{n}} lần.",
        "leadFreezes.item.waitingNone": "Chưa có sự kiện nào đang chờ.",
        "leadFreezes.item.waiting": "{{n}} sự kiện đang chờ (tin nhắn, giao dịch, hẹn giờ).",
        "leadFreezes.item.retry":
            "Thử lại: chạy lại lượt lỗi từ đúng bước lỗi, kèm các tin khách mới nhắn; thành công thì mở lại cho khách và chạy các sự kiện đang chờ theo thứ tự.",
        "leadFreezes.item.takeOver": "Tiếp quản: bạn tự trả lời khách; khách vẫn được giữ, AI không nhắn gì thêm.",
        "leadFreezes.item.skip":
            "Bỏ qua lượt này: bỏ lượt lỗi, mở lại cho khách và chạy các sự kiện đang chờ theo thứ tự.",
        "leadFreezes.error.unknown": "không rõ",
        "leadFreezes.error.GRAPH_NODES_EXECUTOR_MISSING": "thiếu phần xử lý của bước này",
        "leadFreezes.error.GRAPH_NODES_TOOL_NOT_GRANTED": "công cụ chưa được cấp quyền",
        "leadFreezes.error.agent_runs_handler_threw": "bước bị lỗi khi chạy",
        "leadFreezes.error.step_timeout": "bước chạy quá thời gian",
        "leadFreezes.outcome.released":
            "Đã chạy lại thành công; khách được mở lại và các sự kiện đang chờ đã chạy tiếp.",
        "leadFreezes.outcome.retrying": "Đang chạy lại; khách được mở lại khi lượt chạy xong.",
        "leadFreezes.outcome.still_frozen": "Chạy lại vẫn lỗi; khách vẫn chờ bạn và việc mới đã được tạo.",
        "leadFreezes.outcome.skipped": "Đã bỏ qua lượt lỗi; khách được mở lại và các sự kiện đang chờ đã chạy tiếp.",
        "leadFreezes.outcome.taken_over": "Bạn đã tiếp quản cuộc trò chuyện.",
        "leadFreezes.outcome.not_retryable":
            "Bước lỗi có thể đã chạy một phần nên không chạy lại được; hãy Tiếp quản hoặc Bỏ qua lượt này.",
        "leadFreezes.outcome.not_frozen": "Khách không còn chờ.",
    },
    en: {
        "errors.LEAD_FREEZES_RECORD_UNREADABLE": "The waiting state of this customer could not be read.",
        "errors.LEAD_FREEZES_CONTENDED": "The waiting state of this customer just changed. Please try again.",
        "errors.LEAD_FREEZES_NOT_FOUND": "This customer is no longer waiting for you to handle an error.",
        "leadFreezes.item.title": "Customer {{name}} is waiting for you: the step {{step}} failed",
        "leadFreezes.item.unnamed": "without a name",
        "leadFreezes.item.error": "Error: {{summary}}.",
        "leadFreezes.item.failures": "Failed {{n}} times.",
        "leadFreezes.item.waitingNone": "No event is waiting yet.",
        "leadFreezes.item.waiting": "{{n}} events are waiting (messages, transactions, timers).",
        "leadFreezes.item.retry":
            "Retry: run the failed turn again from the failed step, with the customer's newest lines; on success the customer is released and the waiting events run in order.",
        "leadFreezes.item.takeOver":
            "Take over: you answer the customer yourself; the customer stays held and the AI sends nothing more.",
        "leadFreezes.item.skip":
            "Skip this turn: give up the failed turn, release the customer and run the waiting events in order.",
        "leadFreezes.error.unknown": "unknown",
        "leadFreezes.error.GRAPH_NODES_EXECUTOR_MISSING": "the step has no executor",
        "leadFreezes.error.GRAPH_NODES_TOOL_NOT_GRANTED": "the tool is not granted",
        "leadFreezes.error.agent_runs_handler_threw": "the step threw",
        "leadFreezes.error.step_timeout": "the step timed out",
        "leadFreezes.outcome.released": "The retry succeeded; the customer is released and the waiting events run on.",
        "leadFreezes.outcome.retrying": "The retry runs; the customer is released when it ends well.",
        "leadFreezes.outcome.still_frozen": "The retry failed again; the customer still waits and a new item is open.",
        "leadFreezes.outcome.skipped":
            "The failed turn was skipped; the customer is released and the waiting events run on.",
        "leadFreezes.outcome.taken_over": "You took the conversation over.",
        "leadFreezes.outcome.not_retryable":
            "The failed step may have acted, so it cannot run again; take over or skip the turn.",
        "leadFreezes.outcome.not_frozen": "The customer no longer waits.",
    },
}
