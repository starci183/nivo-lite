import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the LangGraph integration codes, Vietnamese and English. */
export const LANGGRAPH_MESSAGES: MessageBundle = {
    vi: {
        "errors.LANGGRAPH_TRACING_FORBIDDEN": "Biến môi trường {key} bật gửi dữ liệu ra dịch vụ theo dõi bên ngoài; ứng dụng không khởi động.",
        "errors.LANGGRAPH_VERSION_MISMATCH": "Lượt chạy thuộc phiên bản quy trình {pinned}, không phải {given}.",
        "errors.LANGGRAPH_THREAD_EXISTS": "Lượt chạy này đã bắt đầu rồi.",
        "errors.LANGGRAPH_THREAD_NOT_STOPPED": "Lượt chạy này không chờ ai trả lời.",
        "errors.LANGGRAPH_ROUTE_UNDECLARED": "Bước {node} đi tới {goto}, nơi nó không khai báo.",
        "errors.LANGGRAPH_NOT_PLAIN": "Giá trị tại {at} không phải JSON thuần nên không lưu được.",
        "errors.LANGGRAPH_GRAPH_UNSOUND": "Quy trình không dựng được tại bước {node}.",
        "errors.LANGGRAPH_THREAD_UNREADABLE": "Không đọc được trạng thái của lượt chạy {thread}.",
        "errors.LANGGRAPH_CHECKPOINT_KEY_INVALID": "Khóa {key} của điểm lưu không hợp lệ.",
        "errors.LANGGRAPH_CHECKPOINT_SCOPE_MISSING": "Điểm lưu thiếu {key} nên không đọc hay ghi được.",
        "errors.LANGGRAPH_CHECKPOINT_FENCED": "Lượt chạy đã được một tiến trình khác tiếp quản; lần ghi này bị từ chối.",
        "errors.LANGGRAPH_CHECKPOINT_TOO_LARGE": "Giá trị cần lưu vào điểm lưu quá lớn.",
        "errors.LANGGRAPH_TOOL_NAME_UNMAPPABLE": "Công cụ {name} không có tên mà nhà cung cấp mô hình chấp nhận.",
    },
    en: {
        "errors.LANGGRAPH_TRACING_FORBIDDEN": "The environment variable {key} turns on tracing to an outside service; the app does not start.",
        "errors.LANGGRAPH_VERSION_MISMATCH": "The run belongs to workflow version {pinned}, not {given}.",
        "errors.LANGGRAPH_THREAD_EXISTS": "This run has already started.",
        "errors.LANGGRAPH_THREAD_NOT_STOPPED": "This run is not waiting for an answer.",
        "errors.LANGGRAPH_ROUTE_UNDECLARED": "Step {node} goes to {goto}, which it did not declare.",
        "errors.LANGGRAPH_NOT_PLAIN": "The value at {at} is not plain JSON and cannot be stored.",
        "errors.LANGGRAPH_GRAPH_UNSOUND": "The workflow cannot be built at step {node}.",
        "errors.LANGGRAPH_THREAD_UNREADABLE": "The state of run {thread} cannot be read.",
        "errors.LANGGRAPH_CHECKPOINT_KEY_INVALID": "The checkpoint key {key} is not valid.",
        "errors.LANGGRAPH_CHECKPOINT_SCOPE_MISSING": "The checkpoint call names no {key}, so nothing is read or written.",
        "errors.LANGGRAPH_CHECKPOINT_FENCED": "Another process took the run over; this write was refused.",
        "errors.LANGGRAPH_CHECKPOINT_TOO_LARGE": "A value to store in a checkpoint is too large.",
        "errors.LANGGRAPH_TOOL_NAME_UNMAPPABLE": "The tool {name} has no name the model provider accepts.",
    },
}
