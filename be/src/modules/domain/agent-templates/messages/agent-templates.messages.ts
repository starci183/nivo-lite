import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-templates codes, Vietnamese and English. */
export const AGENT_TEMPLATES_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_TEMPLATES_TEMPLATE_NOT_FOUND": "Không tìm thấy mẫu này.",
        "errors.AGENT_TEMPLATES_VERSION_NOT_FOUND": "Mẫu này không có phiên bản đó.",
        "errors.AGENT_TEMPLATES_KEY_TAKEN": "Mã mẫu này đã có người dùng.",
        "errors.AGENT_TEMPLATES_NOT_YOURS": "Mẫu này của tài khoản khác.",
        "errors.AGENT_TEMPLATES_PACKAGE_REFUSED":
            "Gói chưa đạt: còn chỗ lộ dữ liệu hoặc chưa khớp. Xem phần xem trước.",
        "errors.AGENT_TEMPLATES_VALUES_REFUSED": "Có giá trị không hợp lệ với tham số của mẫu.",
        "errors.AGENT_TEMPLATES_BASE_AGENT_EXISTS": "Shop này đã có loại agent này và loại này chỉ cho một.",
        "errors.AGENT_TEMPLATES_FOREIGN_TEMPLATE": "Sơ đồ có nhánh từ mẫu của người khác, không thể đóng gói lại.",
        "errors.AGENT_TEMPLATES_GRAPH_VERSION_NOT_FOUND": "Không tìm thấy phiên bản sơ đồ này của agent.",
        "errors.AGENT_TEMPLATES_NOT_A_TEMPLATE_INSTALL": "Agent này không cài từ mẫu.",
    },
    en: {
        "errors.AGENT_TEMPLATES_TEMPLATE_NOT_FOUND": "That template was not found.",
        "errors.AGENT_TEMPLATES_VERSION_NOT_FOUND": "The template has no such version.",
        "errors.AGENT_TEMPLATES_KEY_TAKEN": "Someone already uses this template key.",
        "errors.AGENT_TEMPLATES_NOT_YOURS": "This template belongs to another account.",
        "errors.AGENT_TEMPLATES_PACKAGE_REFUSED":
            "The package is not ready: something leaks or does not fit. See the preview.",
        "errors.AGENT_TEMPLATES_VALUES_REFUSED": "A value does not fit a parameter of the template.",
        "errors.AGENT_TEMPLATES_BASE_AGENT_EXISTS":
            "This workspace already has this kind of agent, and it allows only one.",
        "errors.AGENT_TEMPLATES_FOREIGN_TEMPLATE":
            "The graph has branches of a template someone else made, which cannot be packaged again.",
        "errors.AGENT_TEMPLATES_GRAPH_VERSION_NOT_FOUND": "That version of the agent graph was not found.",
        "errors.AGENT_TEMPLATES_NOT_A_TEMPLATE_INSTALL": "This agent was not installed from a template.",
    },
}
