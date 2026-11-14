import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-instances codes, Vietnamese and English. */
export const AGENT_INSTANCES_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_INSTANCES_NAME_INVALID": "Tên agent cần từ {{min}} đến {{max}} ký tự.",
        "errors.AGENT_INSTANCES_HANDLE_INVALID":
            "Tên gọi @ cần {{min}} đến {{max}} ký tự: chữ thường, số và dấu gạch ngang, bắt đầu bằng chữ.",
        "errors.AGENT_INSTANCES_AVATAR_PRESET_INVALID": "Ảnh mẫu này không có sẵn.",
        "errors.AGENT_INSTANCES_COPY_SOURCE_INVALID": "Không tìm thấy agent cùng vai trò để sao chép thiết lập.",
        "errors.AGENT_INSTANCES_CHANNEL_UNAVAILABLE": "Kênh đã chọn không dùng được cho vai trò này.",
        "errors.AGENT_INSTANCES_CHANNEL_OWNED": "{{agent}} đang nhận kênh này.",
        "errors.AGENT_INSTANCES_CHANNELS_NEED_OWNER": "Chỉ chủ cửa hàng mới gán kênh cho agent.",
        "errors.AGENT_INSTANCES_FRONT_DOOR_FAILED":
            "Không thêm được agent nhận tin của khách cho kênh này, nên kênh chưa có agent trả lời. Hãy thử kết nối lại.",
    },
    en: {
        "errors.AGENT_INSTANCES_NAME_INVALID": "An agent name needs {{min}} to {{max}} characters.",
        "errors.AGENT_INSTANCES_HANDLE_INVALID":
            "A handle needs {{min}} to {{max}} characters: lowercase letters, digits and hyphens, starting with a letter.",
        "errors.AGENT_INSTANCES_AVATAR_PRESET_INVALID": "That preset picture is not available.",
        "errors.AGENT_INSTANCES_COPY_SOURCE_INVALID": "No agent of the same role was found to copy the setup from.",
        "errors.AGENT_INSTANCES_CHANNEL_UNAVAILABLE": "A chosen channel cannot be used by this role.",
        "errors.AGENT_INSTANCES_CHANNEL_OWNED": "{{agent}} already answers this channel.",
        "errors.AGENT_INSTANCES_CHANNELS_NEED_OWNER": "Only the owner gives an agent channels.",
        "errors.AGENT_INSTANCES_FRONT_DOOR_FAILED":
            "The agent that receives this channel's customers could not be added, so the channel has no agent answering it. Connect it again.",
    },
}
