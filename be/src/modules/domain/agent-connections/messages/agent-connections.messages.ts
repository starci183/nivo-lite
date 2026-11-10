import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the agent-connections codes, Vietnamese and English. */
export const AGENT_CONNECTIONS_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENT_CONNECTIONS_TARGET_NOT_FOUND": "Agent hoặc kết nối không thuộc không gian làm việc này.",
        "errors.AGENT_CONNECTIONS_CHANNEL_OWNED":
            "{{agent}} đang nhận kênh này. Mỗi kênh chỉ có một agent của mỗi vai trò trả lời.",
        "errors.AGENT_CONNECTIONS_RESUME_CONFLICT":
            "{{agent}} đang tạm dừng, còn {{channels}} giờ do {{owners}} nhận. Chọn giữ {{agent}} hoặc giữ agent đang nhận rồi bật lại.",
        "errors.AGENT_CONNECTIONS_OUT_OF_SCOPE":
            "Agent này nằm ngoài phòng và vai trò bạn quản lý. Chỉ chủ sở hữu gán kênh cho agent này.",
    },
    en: {
        "errors.AGENT_CONNECTIONS_TARGET_NOT_FOUND": "The agent or the connection is not in this workspace.",
        "errors.AGENT_CONNECTIONS_CHANNEL_OWNED":
            "{{agent}} already answers this channel. Each channel has one agent per role.",
        "errors.AGENT_CONNECTIONS_RESUME_CONFLICT":
            "{{agent}} is paused, and {{channels}} is now answered by {{owners}}. Choose to keep {{agent}} or the agent answering now, then resume.",
        "errors.AGENT_CONNECTIONS_OUT_OF_SCOPE":
            "This agent is outside the rooms and roles you manage. Only the owner assigns channels to it.",
    },
}
