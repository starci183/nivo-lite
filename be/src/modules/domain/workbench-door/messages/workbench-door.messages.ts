import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the workbench door codes, Vietnamese and English. */
export const WORKBENCH_DOOR_MESSAGES: MessageBundle = {
    vi: {
        "errors.WORKBENCH_DOOR_READ_UNKNOWN": "Không tìm thấy nguồn dữ liệu này.",
        "errors.WORKBENCH_DOOR_ACTION_UNKNOWN": "Không tìm thấy thao tác này.",
        "errors.WORKBENCH_DOOR_PAYLOAD_INVALID": "Dữ liệu gửi lên không hợp lệ.",
        "errors.WORKBENCH_DOOR_PERMISSION_DENIED": "Bạn không có quyền thực hiện thao tác này.",
        "errors.WORKBENCH_DOOR_PORT_UNPROVIDED": "Hệ thống chưa cung cấp dữ liệu mà thao tác này cần.",
        "errors.WORKBENCH_DOOR_EXTERNAL_IN_TX": "Thao tác gọi ra ngoài không được chạy trong một giao dịch.",
        "errors.WORKBENCH_DOOR_REGISTRY_DUPLICATE": "Hai mô-đun khai báo trùng một tên.",
        "errors.WORKBENCH_DOOR_REGISTRY_ID_INVALID": "Tên khai báo không đúng dạng mô-đun.tên.",
        "errors.WORKBENCH_DOOR_REGISTRY_PORT_UNKNOWN": "Khai báo dùng một cổng mà hệ thống không có.",
        "errors.WORKBENCH_DOOR_REGISTRY_ENTITY_MISSING": "Khai báo dùng một loại dữ liệu chưa được khai báo.",
        "errors.WORKBENCH_DOOR_ACTION_CONFLICT": "Dữ liệu đã thay đổi. Hãy tải lại rồi thử lại.",
        "errors.WORKBENCH_DOOR_ACTION_FAILED": "Chưa hoàn tất thao tác. Vui lòng thử lại sau.",
        "errors.WORKBENCH_DOOR_ACTION_REFUSED": "Thao tác cần được người có thẩm quyền duyệt trước.",
    },
    en: {
        "errors.WORKBENCH_DOOR_READ_UNKNOWN": "That data source does not exist.",
        "errors.WORKBENCH_DOOR_ACTION_UNKNOWN": "That action does not exist.",
        "errors.WORKBENCH_DOOR_PAYLOAD_INVALID": "The data sent is not valid.",
        "errors.WORKBENCH_DOOR_PERMISSION_DENIED": "You do not have permission to do this.",
        "errors.WORKBENCH_DOOR_PORT_UNPROVIDED": "The system does not provide the data this action needs.",
        "errors.WORKBENCH_DOOR_EXTERNAL_IN_TX": "An action that calls out cannot run inside a transaction.",
        "errors.WORKBENCH_DOOR_REGISTRY_DUPLICATE": "Two modules declare the same name.",
        "errors.WORKBENCH_DOOR_REGISTRY_ID_INVALID": "A declared name is not of the form module.name.",
        "errors.WORKBENCH_DOOR_REGISTRY_PORT_UNKNOWN": "A declaration uses a port the system does not have.",
        "errors.WORKBENCH_DOOR_REGISTRY_ENTITY_MISSING": "A declaration uses a kind of data nobody declared.",
        "errors.WORKBENCH_DOOR_ACTION_CONFLICT": "The data changed. Reload and try again.",
        "errors.WORKBENCH_DOOR_ACTION_FAILED": "The action did not finish. Please try again later.",
        "errors.WORKBENCH_DOOR_ACTION_REFUSED": "The action needs approval from someone with authority first.",
    },
}
