import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agents codes, Vietnamese and English. */
export const AGENTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENTS_INSTALLATION_NOT_FOUND": "Không tìm thấy agent này trong không gian làm việc.",
        "errors.AGENTS_AGENT_NOT_FOUND": "Không tìm thấy agent.",
        "errors.AGENTS_HANDLE_TAKEN": "Tên gọi @{{handle}} đã có agent khác dùng.",
        "errors.AGENTS_NOT_CREATED": "Không tạo được agent.",
        "errors.AGENTS_KNOWLEDGE_UNBOUND": "Ứng dụng này không đọc được tri thức của agent.",
        "errors.AGENTS_OWNER_UNAVAILABLE":
            "Agent này chưa có người phụ trách đang hoạt động. Hãy chọn người phụ trách mới.",
        "errors.AGENTS_OWNERSHIP_INVALID": "Thiết lập người phụ trách không hợp lệ: {{field}}.",
        "errors.AGENTS_NAME_INVALID": "Tên agent cần từ {{min}} đến {{max}} ký tự.",
        "errors.AGENTS_AVATAR_INVALID": "Ảnh đại diện phải là địa chỉ HTTPS.",
        "errors.AGENTS_AVATAR_PRESET_INVALID": "Ảnh mẫu này không có sẵn.",
        "errors.AGENTS_TAG_TARGET_MISSING": "Không tìm thấy agent được gắn thẻ.",
        "errors.AGENTS_TAG_REFUSED": "Agent này không được gắn thẻ agent kia.",
    },
    en: {
        "errors.AGENTS_INSTALLATION_NOT_FOUND": "This agent was not found in the workspace.",
        "errors.AGENTS_AGENT_NOT_FOUND": "The agent was not found.",
        "errors.AGENTS_HANDLE_TAKEN": "Another agent already uses the handle @{{handle}}.",
        "errors.AGENTS_NOT_CREATED": "The agent could not be created.",
        "errors.AGENTS_KNOWLEDGE_UNBOUND": "This app cannot read the knowledge of an agent.",
        "errors.AGENTS_OWNER_UNAVAILABLE": "This agent has no active person in charge. Choose a new owner.",
        "errors.AGENTS_OWNERSHIP_INVALID": "The ownership settings are not valid: {{field}}.",
        "errors.AGENTS_NAME_INVALID": "An agent name needs {{min}} to {{max}} characters.",
        "errors.AGENTS_AVATAR_INVALID": "The picture must be an HTTPS address.",
        "errors.AGENTS_AVATAR_PRESET_INVALID": "That preset picture is not available.",
        "errors.AGENTS_TAG_TARGET_MISSING": "The tagged agent was not found.",
        "errors.AGENTS_TAG_REFUSED": "This agent may not tag that agent.",
    },
}
