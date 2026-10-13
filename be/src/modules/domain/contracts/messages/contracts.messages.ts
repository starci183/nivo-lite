import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the contracts codes and the lines the capability writes into the evidence log, Vietnamese and English. */
export const CONTRACTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.CONTRACTS_LEAD_NOT_FOUND": "Không tìm thấy khách hàng này.",
        "errors.CONTRACTS_NOT_FOUND": "Không tìm thấy hợp đồng này.",
        "errors.CONTRACTS_CUSTOMER_REQUIRED": "Hãy nhập tên khách.",
        "errors.CONTRACTS_DATE_INVALID": "Nhập ngày theo dạng YYYY-MM-DD.",
        "errors.CONTRACTS_DATES_REVERSED": "Ngày hết hạn không được trước ngày bắt đầu.",
        "errors.CONTRACTS_STATUS_INVALID": "Trạng thái phải là một trong: {{list}}.",
        "errors.CONTRACTS_AMOUNT_INVALID": "Giá trị phải từ 0 trở lên.",
        "contracts.created": "{{who}} thêm hợp đồng cho {{customer}}",
        "contracts.updated": "{{who}} cập nhật hợp đồng của {{customer}}",
    },
    en: {
        "errors.CONTRACTS_LEAD_NOT_FOUND": "That lead no longer exists.",
        "errors.CONTRACTS_NOT_FOUND": "That contract no longer exists.",
        "errors.CONTRACTS_CUSTOMER_REQUIRED": "Enter the customer name.",
        "errors.CONTRACTS_DATE_INVALID": "Enter dates as YYYY-MM-DD.",
        "errors.CONTRACTS_DATES_REVERSED": "The end date cannot be before the start date.",
        "errors.CONTRACTS_STATUS_INVALID": "Status must be one of: {{list}}.",
        "errors.CONTRACTS_AMOUNT_INVALID": "The amount must be zero or more.",
        "contracts.created": "{{who}} added a contract for {{customer}}",
        "contracts.updated": "{{who}} updated the contract for {{customer}}",
    },
}
