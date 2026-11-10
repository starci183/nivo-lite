import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the graph-nodes codes, Vietnamese and English. */
export const GRAPH_NODES_MESSAGES: MessageBundle = {
    vi: {
        "errors.GRAPH_NODES_NODE_UNKNOWN": "Bước {{node}} chưa được cài đặt.",
        "errors.GRAPH_NODES_PORT_DUPLICATE": "Loại {{kind}} đã có nơi xử lý.",
        "errors.GRAPH_NODES_PORT_MISSING": "Chưa có nơi cung cấp dữ liệu loại {{kind}}.",
        "errors.GRAPH_NODES_EXECUTOR_MISSING": "Chưa có nơi thực hiện việc {{effect}}.",
        "errors.GRAPH_NODES_TOOL_DOOR_MISSING": "Chưa kết nối cổng công cụ NIVO để gọi {{tool}}.",
        "errors.GRAPH_NODES_TOOL_NOT_CONNECTED": "Workspace chưa kết nối nhà cung cấp cho {{tool}}.",
        "errors.GRAPH_NODES_TOOL_NOT_GRANTED": "Trợ lý chưa được cấp quyền dùng công cụ {{tool}}.",
        "errors.GRAPH_NODES_TOOL_CONNECTION_REFUSED":
            "Nhà cung cấp từ chối kết nối của workspace cho {{tool}}; chủ workspace cần kết nối lại.",
        "errors.GRAPH_NODES_TOOL_APPROVAL_REQUIRED": "Công cụ {{tool}} cần chủ workspace duyệt trước khi chạy.",
        "errors.GRAPH_NODES_TOOL_TOKEN_INVALID": "Lệnh gọi {{tool}} không có thẻ phiên chạy hợp lệ.",
        "errors.GRAPH_NODES_AGENT_LOOP_FLAG_INVALID": "Cờ AGENT_LOOP không hợp lệ: {{name}}.",
        "errors.GRAPH_NODES_TOOL_FAILED": "Công cụ {{tool}} không chạy được: {{reason}}.",
        "errors.GRAPH_NODES_EFFECT_NOT_RECORDED": "Việc {{effect}} đã chạy nhưng chưa ghi được vào sổ.",
        "errors.GRAPH_NODES_EFFECT_KEY_TAKEN": "Khóa của việc {{effect}} đang do việc {{heldBy}} giữ nên không chạy.",
    },
    en: {
        "errors.GRAPH_NODES_NODE_UNKNOWN": "The step {{node}} is not installed.",
        "errors.GRAPH_NODES_PORT_DUPLICATE": "The kind {{kind}} already has a handler.",
        "errors.GRAPH_NODES_PORT_MISSING": "Nothing serves the data kind {{kind}} yet.",
        "errors.GRAPH_NODES_EXECUTOR_MISSING": "Nothing performs {{effect}} yet.",
        "errors.GRAPH_NODES_TOOL_DOOR_MISSING": "The NIVO tool door is not connected, so {{tool}} cannot be called.",
        "errors.GRAPH_NODES_TOOL_NOT_CONNECTED": "The workspace has no connected provider for {{tool}}.",
        "errors.GRAPH_NODES_TOOL_NOT_GRANTED": "The agent has no grant to use the tool {{tool}}.",
        "errors.GRAPH_NODES_TOOL_CONNECTION_REFUSED":
            "The provider refused the workspace's connection for {{tool}}; the owner has to connect it again.",
        "errors.GRAPH_NODES_TOOL_APPROVAL_REQUIRED": "The tool {{tool}} needs the owner's approval before it runs.",
        "errors.GRAPH_NODES_TOOL_TOKEN_INVALID": "The call of {{tool}} carries no valid run token.",
        "errors.GRAPH_NODES_AGENT_LOOP_FLAG_INVALID": "The AGENT_LOOP flag is not valid: {{name}}.",
        "errors.GRAPH_NODES_TOOL_FAILED": "The tool {{tool}} could not run: {{reason}}.",
        "errors.GRAPH_NODES_EFFECT_NOT_RECORDED": "The effect {{effect}} ran but could not be written to the ledger.",
        "errors.GRAPH_NODES_EFFECT_KEY_TAKEN": "The key of the effect {{effect}} is held by {{heldBy}}, so it did not run.",
    },
}
