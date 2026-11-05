import type { MessageBundle } from "@modules/platform/i18n"

/** The localized refusal lines of the entity engine. */
export const ENTITY_ENGINE_MESSAGES: MessageBundle = {
    vi: {
        "errors.ENTITY_ENGINE_SCOPE_INVALID": "Không xác định được không gian làm việc.",
        "errors.ENTITY_ENGINE_SCOPE_VIOLATION": "Bạn không có quyền truy cập dữ liệu này.",
        "errors.ENTITY_ENGINE_CONSTRAINT_UNDECLARED": "Dữ liệu bị trùng với một bản ghi đã có.",
        "errors.ENTITY_ENGINE_UNAVAILABLE": "Hệ thống đang bận. Vui lòng thử lại sau.",
        "errors.ENTITY_ENGINE_FAILED": "Không thể hoàn tất thao tác với dữ liệu.",
        "errors.ENTITY_ENGINE_ENTITY_UNKNOWN": "Loại dữ liệu này không tồn tại.",
        "errors.ENTITY_ENGINE_QUERY_INVALID": "Yêu cầu đọc dữ liệu không hợp lệ.",
        "errors.ENTITY_ENGINE_MUTATION_INVALID": "Yêu cầu ghi dữ liệu không hợp lệ.",
        "errors.ENTITY_ENGINE_CURSOR_INVALID": "Trang kế tiếp không hợp lệ. Hãy tải lại danh sách.",
        "errors.ENTITY_ENGINE_CONFIG_CURSOR_KEY_INVALID": "Khóa ký con trỏ phân trang chưa được cấu hình đúng.",
        "errors.ENTITY_ENGINE_JOB_PAYLOAD_INVALID": "Công việc nền thiếu thông tin cần thiết.",
        "errors.ENTITY_ENGINE_JOB_UNKNOWN": "Công việc nền này chưa được khai báo.",
        "errors.ENTITY_ENGINE_JOB_INPUT_INVALID": "Dữ liệu đầu vào của công việc nền không hợp lệ.",
        "errors.ENTITY_ENGINE_PORT_UNPROVIDED": "Công việc yêu cầu một cổng mà hệ thống chưa cung cấp.",
    },
    en: {
        "errors.ENTITY_ENGINE_SCOPE_INVALID": "The workspace could not be determined.",
        "errors.ENTITY_ENGINE_SCOPE_VIOLATION": "You do not have access to this data.",
        "errors.ENTITY_ENGINE_CONSTRAINT_UNDECLARED": "The data clashes with an existing record.",
        "errors.ENTITY_ENGINE_UNAVAILABLE": "The system is busy. Please try again shortly.",
        "errors.ENTITY_ENGINE_FAILED": "The data operation could not finish.",
        "errors.ENTITY_ENGINE_ENTITY_UNKNOWN": "That kind of data does not exist.",
        "errors.ENTITY_ENGINE_QUERY_INVALID": "The data read request is invalid.",
        "errors.ENTITY_ENGINE_MUTATION_INVALID": "The data write request is invalid.",
        "errors.ENTITY_ENGINE_CURSOR_INVALID": "The next page is not valid. Reload the list.",
        "errors.ENTITY_ENGINE_CONFIG_CURSOR_KEY_INVALID":
            "The pagination cursor signing key is not configured correctly.",
        "errors.ENTITY_ENGINE_JOB_PAYLOAD_INVALID": "The background job is missing required information.",
        "errors.ENTITY_ENGINE_JOB_UNKNOWN": "That background job is not declared.",
        "errors.ENTITY_ENGINE_JOB_INPUT_INVALID": "The input of the background job is invalid.",
        "errors.ENTITY_ENGINE_PORT_UNPROVIDED": "The job asks for a port the system does not provide.",
    },
}
