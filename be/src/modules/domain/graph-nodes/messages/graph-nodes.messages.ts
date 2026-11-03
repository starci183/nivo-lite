import type { MessageBundle } from "@modules/platform/i18n"

/** Display text of the graph-nodes codes, Vietnamese and English. */
export const GRAPH_NODES_MESSAGES: MessageBundle = {
    vi: {
        "errors.GRAPH_NODES_NODE_UNKNOWN": "Bước {{node}} chưa được cài đặt.",
        "errors.GRAPH_NODES_PORT_DUPLICATE": "Loại {{kind}} đã có nơi xử lý.",
        "errors.GRAPH_NODES_PORT_MISSING": "Chưa có nơi cung cấp dữ liệu loại {{kind}}.",
        "errors.GRAPH_NODES_EXECUTOR_MISSING": "Chưa có nơi thực hiện việc {{effect}}.",
        "errors.GRAPH_NODES_TOOL_DOOR_MISSING": "Chưa kết nối cổng công cụ NIVO để gọi {{tool}}.",
    },
    en: {
        "errors.GRAPH_NODES_NODE_UNKNOWN": "The step {{node}} is not installed.",
        "errors.GRAPH_NODES_PORT_DUPLICATE": "The kind {{kind}} already has a handler.",
        "errors.GRAPH_NODES_PORT_MISSING": "Nothing serves the data kind {{kind}} yet.",
        "errors.GRAPH_NODES_EXECUTOR_MISSING": "Nothing performs {{effect}} yet.",
        "errors.GRAPH_NODES_TOOL_DOOR_MISSING": "The NIVO tool door is not connected, so {{tool}} cannot be called.",
    },
}
