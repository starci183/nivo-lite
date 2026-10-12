/** Copy-ready curl examples for the public API (base = origin + /api/v1). */
export const buildExamples = (base: string) => {
  const auth = `-H "Authorization: Bearer nvk_..."`
  const json = `-H "Content-Type: application/json"`
  return {
    header: "Authorization: Bearer nvk_...",
    leadsPost: `curl -X POST ${base}/leads \\
  ${auth} \\
  ${json} \\
  -d '{"name":"Nguyễn Văn A","phone":"0901234567","email":"a@example.com","company":"","need":"Hỏi giá gói 3 tháng","channel":"Zalo","stage":"new"}'

# 201 {"data":{"lead_id":"...","status":"created","work_item_id":"..."}}`,
    messagesPost: `curl -X POST ${base}/messages \\
  ${auth} \\
  ${json} \\
  -d '{"lead_id":"<uuid>","text":"Chào anh, bên em gửi báo giá..."}'

# 202 {"data":{"work_item_id":"...","status":"sent"}}  (hoặc "waiting_decision")`,
    knowledgePost: `curl -X POST ${base}/knowledge \\
  ${auth} \\
  ${json} \\
  -d '{"title":"Bảng giá","content":"...","topic":"Giá","visibility":"internal"}'`,
    leadsGet: `curl "${base}/leads?status=new" \\
  ${auth}`,
    eventsGet: `curl "${base}/events?since=2026-10-01T00:00:00Z" \\
  ${auth}`,
    n8nUrl: `${base}/leads`,
    n8nBody: `{
  "name": "Nguyễn Văn A",
  "phone": "0901234567",
  "need": "Hỏi giá gói 3 tháng",
  "channel": "Zalo",
  "stage": "new"
}`,
  }
}
