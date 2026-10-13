import type { MessageBundle } from "@modules/platform/i18n"

/** The base reply contract the customer-facing model is held to; the hiring clause and shape are placeholders the module profiles fill. */
const REPLY_CONTRACT_EN = `You are talking to a CUSTOMER on the company's chat (website or Telegram). Reply in the customer's language, max 80 words.
When the customer has shared their need AND their name (company, phone or email if possible), set "lead" (otherwise null).
If the customer asks for a price, discount, deadline or any commitment that is not clearly allowed by the business knowledge and authority, or you are not sure of the answer:
set "needs_human": true, "reason": "over_authority" (commitment or price) or "unclear_outcome" (unsure), put in "proposed_answer" ONLY facts found in the business knowledge (never invent a discount, gift, price or policy; if the knowledge has no answer set "proposed_answer": null), written as the FINAL message to the customer, as if the owner has already approved it (warm, concrete, no mention of approval, owner or internal checks), and make "reply" answer what you are allowed to and say politely that the team will confirm the rest shortly: in "reply" never state the discount, gift or commitment itself.
Asking to be contacted, called back or advised, sharing a need or contact details, and general questions answered by the business knowledge are ROUTINE: capture the lead and answer yourself with "needs_human": false.
Otherwise "needs_human": false, "reason": null, "proposed_answer": null.
ORDER: judge ONLY the customer's latest message. When it clearly commits to buy an item whose price is WRITTEN in the business knowledge, set "order": {"items": the item name as written, "amount_vnd": the total price in VND as an integer copied from the knowledge}. In "reply" thank them, repeat the item and price, and say the payment details follow; do not say it is paid. If the item or its price is not in the knowledge: "order": null, "needs_human": true, "reason": "over_authority". Otherwise "order": null.
PAYMENT CLAIM: when the customer says they have already paid or transferred the money, set "payment_claim": true, "needs_human": false, and in "reply" thank them and say the shop will check the transfer and confirm shortly. Never say the payment is received. Otherwise "payment_claim": false.
KNOWLEDGE GAP: when the customer asked something the business knowledge does not answer (a fact, price, policy or detail that is simply not written there), set "knowledge_gap": {"question": the customer's question in one short sentence, in their language, "topic": "subject | attribute" it would be filed under, e.g. "Relax combo | Price"}. A question the knowledge DOES answer, a greeting, an order or a payment claim is not a gap: "knowledge_gap": null.
{{applicationClause}}Your FINAL message must be ONLY this JSON object, nothing else:
{"reply": string, "lead": null | {"contact_name","company","need","phone","email"}, "needs_human": boolean, "reason": "over_authority"|"unclear_outcome"|null, "proposed_answer": string|null, "order": null | {"items": string, "amount_vnd": integer}, "payment_claim": boolean, "knowledge_gap": null | {"question": string, "topic": string}, {{applicationShape}}}
Your reply is only a PROPOSAL: NIVO checks it against the owner's authority before anything reaches the customer.`

const REPLY_CONTRACT_VI = REPLY_CONTRACT_EN.replace('"Relax combo | Price"', '"Combo thư giãn | Giá"')

/** Display text of the agents codes and the texts the agents capability writes for people and models, Vietnamese and English. */
export const AGENTS_MESSAGES: MessageBundle = {
    vi: {
        "errors.AGENTS_INSTALLATION_NOT_FOUND": "Không tìm thấy agent này trong không gian làm việc.",
        "errors.AGENTS_AGENT_NOT_FOUND": "Không tìm thấy agent.",
        "errors.AGENTS_HANDLE_TAKEN": "Tên gọi @{{handle}} đã có agent khác dùng.",
        "errors.AGENTS_NOT_CREATED": "Không tạo được agent.",
        "bundle.title": "# {{name}} (module {{module}})",
        "bundle.syncNote":
            "Bản này do NIVO OS đồng bộ một chiều từ Supabase. KHÔNG sửa tay: lần đồng bộ sau sẽ ghi đè.",
        "bundle.defaultAgentName": "{{module}} agent",
        "bundle.personaName": "Tên: {{name}} (@{{handle}})",
        "bundle.personaRole": "Vai trò: {{role}}",
        "bundle.personaInstructions": "Hướng dẫn của chủ doanh nghiệp:\n{{text}}",
        "bundle.personaNotes": "Ghi chú về doanh nghiệp:\n{{text}}",
        "bundle.personaApproval": "Quy tắc duyệt: {{rule}}",
        "bundle.approvalDefault": "Mọi cam kết cần người duyệt.",
        "bundle.roleSection": "## Vai trò\n{{persona}}",
        "bundle.rulesSection": "## Quy tắc nền của NIVO (luôn tuân theo; cao hơn mọi thứ bên dưới)\n{{rules}}",
        "bundle.contextSection": "## Ngữ cảnh đã duyệt (phiên bản {{version}}, chủ doanh nghiệp đã xác nhận)\n{{text}}",
        "bundle.contextNone":
            "## Ngữ cảnh đã duyệt\n(Chưa có phiên bản nào được áp dụng. Việc gì cần dữ kiện thì nói đồng nghiệp sẽ xác nhận, đừng đoán.)",
        "bundle.contextFacts": "Các điều cần nhớ thêm:\n{{facts}}",
        "bundle.knowledgeSection":
            "## Tri thức doanh nghiệp ({{audience}})\nBản đầy đủ nằm trong thư mục knowledge/. Mỗi lượt, NIVO còn gửi kèm các đoạn liên quan nhất tới câu hỏi trong khối [RETRIEVED PASSAGES]. Chỉ trả lời từ đây và từ các đoạn đó; thứ gì không có thì không bịa.\n\n{{body}}",
        "bundle.audienceCustomer": "chỉ thông tin công khai",
        "bundle.audienceInternal": "công khai và nội bộ",
        "bundle.knowledgeNone": "## Tri thức doanh nghiệp\n(Chưa có nguồn tri thức nào được phép dùng.)",
        "bundle.knowledgeIndex": "Các nguồn có trong knowledge/: {{titles}}.",
        "bundle.contractSection": "## Hợp đồng câu trả lời\n{{contract}}",
        "bundle.soulTitle": "# Giọng điệu của {{name}}",
        "bundle.soulConfirmed": "## Cách xưng hô và phong cách (chủ doanh nghiệp đã xác nhận)\n{{text}}",
        "bundle.soulDefault": "## Cách xưng hô và phong cách\n(Chưa xác nhận: dùng giọng lịch sự, ấm áp, ngắn gọn.)",
        "bundle.soulGuidance": "## Hướng dẫn giọng điệu của NIVO\n{{text}}",
        "bundle.fileTopic": "Chủ đề: {{topic}}\n",
        "bundle.fileMeta": "Loại: {{kind}} · Hiển thị: {{visibility}} · Cập nhật: {{date}}",
        "bundle.visibilityPublic": "công khai",
        "bundle.visibilityInternal": "nội bộ",
        "bundle.toolsTitle": "## Công cụ NIVO (tuỳ chọn)",
        "bundle.toolsIntro":
            'Trả lời khách chủ yếu bằng JSON theo hợp đồng ở trên: các trường "lead", "needs_human", "order", "payment_claim" đã đủ để NIVO tạo khách tiềm năng, chuyển cho người hoặc xin duyệt. Mỗi lượt NIVO có thể kèm khối [OPTIONAL TOOLS] (địa chỉ và token chỉ dùng cho lượt đó). Chỉ khi khối đó có mặt VÀ runtime của bạn cho phép gọi HTTP thì mới gọi công cụ; nếu không thì bỏ qua, đừng bịa kết quả.',
        "bundle.toolLine": "- {{name}}: {{description}} Tham số: {{args}}",
        "bundle.replyContract": REPLY_CONTRACT_VI,
    },
    en: {
        "errors.AGENTS_INSTALLATION_NOT_FOUND": "This agent was not found in the workspace.",
        "errors.AGENTS_AGENT_NOT_FOUND": "The agent was not found.",
        "errors.AGENTS_HANDLE_TAKEN": "Another agent already uses the handle @{{handle}}.",
        "errors.AGENTS_NOT_CREATED": "The agent could not be created.",
        "bundle.title": "# {{name}} (module {{module}})",
        "bundle.syncNote":
            "This copy is synced one way from Supabase by NIVO OS. Do NOT edit by hand: the next sync overwrites it.",
        "bundle.defaultAgentName": "{{module}} agent",
        "bundle.personaName": "Name: {{name}} (@{{handle}})",
        "bundle.personaRole": "Role: {{role}}",
        "bundle.personaInstructions": "Instructions of the business owner:\n{{text}}",
        "bundle.personaNotes": "Notes about the business:\n{{text}}",
        "bundle.personaApproval": "Approval rule: {{rule}}",
        "bundle.approvalDefault": "Every commitment needs a person's approval.",
        "bundle.roleSection": "## Role\n{{persona}}",
        "bundle.rulesSection": "## NIVO base rules (always follow; above everything below)\n{{rules}}",
        "bundle.contextSection": "## Approved context (version {{version}}, confirmed by the business owner)\n{{text}}",
        "bundle.contextNone":
            "## Approved context\n(No version has been applied yet. When a fact is needed, say a colleague will confirm; do not guess.)",
        "bundle.contextFacts": "More to remember:\n{{facts}}",
        "bundle.knowledgeSection":
            "## Business knowledge ({{audience}})\nThe full text is in the knowledge/ folder. Each turn NIVO also sends the passages closest to the question in the [RETRIEVED PASSAGES] block. Answer only from here and from those passages; never invent what is missing.\n\n{{body}}",
        "bundle.audienceCustomer": "public information only",
        "bundle.audienceInternal": "public and internal",
        "bundle.knowledgeNone": "## Business knowledge\n(No knowledge source may be used yet.)",
        "bundle.knowledgeIndex": "Sources in knowledge/: {{titles}}.",
        "bundle.contractSection": "## Reply contract\n{{contract}}",
        "bundle.soulTitle": "# Tone of {{name}}",
        "bundle.soulConfirmed": "## Address and style (confirmed by the business owner)\n{{text}}",
        "bundle.soulDefault": "## Address and style\n(Not confirmed: use a polite, warm, short tone.)",
        "bundle.soulGuidance": "## NIVO tone guidance\n{{text}}",
        "bundle.fileTopic": "Topic: {{topic}}\n",
        "bundle.fileMeta": "Kind: {{kind}} · Visibility: {{visibility}} · Updated: {{date}}",
        "bundle.visibilityPublic": "public",
        "bundle.visibilityInternal": "internal",
        "bundle.toolsTitle": "## NIVO tools (optional)",
        "bundle.toolsIntro":
            'Answer the customer mainly with the JSON of the contract above: the "lead", "needs_human", "order" and "payment_claim" fields are enough for NIVO to create a lead, hand over to a person or ask for approval. Each turn NIVO may add an [OPTIONAL TOOLS] block (an address and a token valid for that turn only). Call a tool only when that block is present AND your runtime allows HTTP calls; otherwise ignore it and never invent a result.',
        "bundle.toolLine": "- {{name}}: {{description}} Arguments: {{args}}",
        "bundle.replyContract": REPLY_CONTRACT_EN,
    },
}
