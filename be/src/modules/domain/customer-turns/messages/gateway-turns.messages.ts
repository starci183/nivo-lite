import type { MessageBundle } from "@modules/platform/i18n"

/** The fixed lines of the connector part of a customer turn (meta-tools, the party, approvals, hand-offs), Vietnamese and English. */
export const GATEWAY_TURNS_MESSAGES: MessageBundle = {
    vi: {
        "gatewayTurns.contract":
            "Kết nối của doanh nghiệp: dùng tool.search để tìm công cụ bạn được cấp, tool.describe để đọc tham số, rồi tool.call (name, arguments_json là một đối tượng JSON) để gọi; khi quy trình của doanh nghiệp gồm nhiều bước cần người duyệt một lần, gửi chúng bằng tool.sequence (steps_json là danh sách các {name, arguments}, reply là câu báo khách sau khi duyệt). Làm theo đúng các bước mà kiến thức của doanh nghiệp (Second Brain, quy trình mẫu, bài học) mô tả. KHÔNG BAO GIỜ nói với khách một kết quả mà công cụ chưa trả về; khi tool.call trả lời approval_requested thì báo khách là đã trình người duyệt. Khi kiến thức nói một agent khác tiếp nhận, gọi conversation.handOff. Khi nguồn mâu thuẫn: dữ liệu trực tiếp từ công cụ > Second Brain > bài học > kiến thức nền.",
        "gatewayTurns.partyKnown": "Khách đã có trong hệ thống của doanh nghiệp: {{name}}.",
        "gatewayTurns.approvalSummary": "{{tool}} cho {{name}}: {{reason}}",
        "gatewayTurns.approvedDone": "Dạ yêu cầu của mình đã được duyệt và hoàn tất ạ.",
        "gatewayTurns.cardHandoff": "Khách {{name}} chuyển từ {{from}} sang {{to}}: {{why}}",
        "gatewayTurns.cardActionDone": "{{what}}: đã thực hiện",
        "gatewayTurns.field.tool": "Công cụ",
        "gatewayTurns.field.customer": "Khách",
    },
    en: {
        "gatewayTurns.contract":
            "Business connectors: use tool.search to find the tools you are granted, tool.describe to read their arguments, then tool.call (name, arguments_json as a JSON object) to call one; when the business playbook has several steps a person approves at once, send them with tool.sequence (steps_json is a list of {name, arguments}, reply is what the customer hears once approved). Follow exactly the steps the business knowledge (Second Brain, seeded playbook, lessons) describes. NEVER tell the customer a result a tool did not answer; when tool.call answers approval_requested, tell the customer it was sent for approval. When the knowledge says another agent takes over, call conversation.handOff. On conflict: live tool data > Second Brain > lessons > base knowledge.",
        "gatewayTurns.partyKnown": "The customer is known to the business systems: {{name}}.",
        "gatewayTurns.approvalSummary": "{{tool}} for {{name}}: {{reason}}",
        "gatewayTurns.approvedDone": "Your request was approved and completed.",
        "gatewayTurns.cardHandoff": "Customer {{name}} moved from {{from}} to {{to}}: {{why}}",
        "gatewayTurns.cardActionDone": "{{what}}: done",
        "gatewayTurns.field.tool": "Tool",
        "gatewayTurns.field.customer": "Customer",
    },
}
