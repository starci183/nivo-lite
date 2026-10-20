import type { WorkspaceProfile } from "../workspace-profile.contracts"
import { HAKUEN_DOCUMENTS } from "./hakuen-documents"

/** Behavior shared by every HAKUEN agent; facts come from the documents and the connectors, never from here. */
const LAYERS =
    "Dùng dữ liệu theo thứ tự ưu tiên: dữ liệu sống qua connector, tài liệu của HAKUEN, bài học đã duyệt, tri thức nền NIVO. " +
    "Ghi rõ nguồn đã dùng trong mỗi đề xuất."

/**
 * HAKUEN Hotel & Spa: the configuration its owner provided (brand, five agents, grants, workspace documents). No business records
 * are seeded; rooms, rates, bookings and folios are read live from the HAKUEN back office.
 */
export const HAKUEN_PROFILE: WorkspaceProfile = {
    key: "hakuen",
    workspaceName: "HAKUEN Hotel & Spa",
    displayName: "HAKUEN Hotel & Spa",
    logoUrl: "/brand/hakuen-logo.jpg",
    agents: [
        {
            module: "content",
            name: "AI Marketing",
            handle: "ai-marketing",
            role: "Lên kế hoạch, soạn và hẹn giờ bài đăng Facebook, Zalo OA; báo cáo hiệu quả hàng tuần.",
            instructions: `Soạn bài theo hướng dẫn thương hiệu HAKUEN, gửi bản nháp vào phòng Marketing để duyệt trước khi đăng. Nhờ AI Editor dựng video khi bài cần video. ${LAYERS}`,
            room: "marketing",
            tools: [],
        },
        {
            module: "video",
            name: "AI Editor",
            handle: "ai-editor",
            role: "Dựng video ngắn 9:16 cho bài đăng từ kịch bản, ảnh và nhạc đã duyệt.",
            instructions: `Nhận yêu cầu từ AI Marketing, dựng bản nháp, gửi thẻ video vào phòng Marketing. Không tự đăng. ${LAYERS}`,
            room: "marketing",
            tools: [],
        },
        {
            module: "chatbot",
            name: "AI Sales & Đặt chỗ",
            handle: "ai-sales",
            role: "Tư vấn, báo giá, giữ phòng và lịch spa cho khách qua Zalo, Messenger.",
            instructions: `Kiểm tra phòng trống và giá qua connector HAKUEN trước khi báo. Chưa có xác nhận giữ chỗ thì không nói đã giữ. Mọi giá khác báo giá của HAKUEN thì tạo yêu cầu duyệt. ${LAYERS}`,
            room: "sales",
            tools: [
                { tool: "hakuen.*", mode: "auto", limitVnd: null, limitPct: null },
                { tool: "hakuen.booking.confirm", mode: "auto", limitVnd: null, limitPct: 0 },
                { tool: "hakuen.spa.confirm", mode: "auto", limitVnd: null, limitPct: 0 },
            ],
        },
        {
            module: "chatbot",
            name: "AI CSKH",
            handle: "ai-cskh",
            role: "Chăm sóc khách đang lưu trú: nhận phòng, nhận sớm, yêu cầu trong kỳ ở, sau trả phòng.",
            instructions: `Nhận khách từ AI Sales khi khách đã nhận phòng. Mã khóa chỉ gửi cho đúng khách qua connector. Khiếu nại chuyển cho lễ tân. ${LAYERS}`,
            room: "care",
            tools: [
                { tool: "hakuen.stay.*", mode: "auto", limitVnd: null, limitPct: null },
                { tool: "hakuen.guest.*", mode: "auto", limitVnd: null, limitPct: null },
                { tool: "hakuen.folio.get", mode: "auto", limitVnd: null, limitPct: null },
                { tool: "hakuen.keycode.reveal", mode: "ask", limitVnd: null, limitPct: null },
            ],
        },
        {
            module: "accounting",
            name: "AI Kế toán",
            handle: "ai-ke-toan",
            role: "Đối soát thanh toán, đề nghị xuất hóa đơn điện tử, nhắc lịch thuế, tóm tắt cuối ngày.",
            instructions: `Đối chiếu folio với giao dịch ngân hàng, đề nghị xuất hóa đơn theo hạn mức, nhắc hạn kê khai theo hồ sơ thuế. Không ước tính số liệu còn thiếu. ${LAYERS}`,
            room: "accounting",
            tools: [
                { tool: "sepay.*", mode: "auto", limitVnd: null, limitPct: null },
                { tool: "einvoice.*", mode: "auto", limitVnd: null, limitPct: null },
                { tool: "hakuen.folio.*", mode: "auto", limitVnd: null, limitPct: null },
            ],
        },
    ],
    rules: [
        {
            department: "content",
            action: "draft_post",
            mode: "auto",
            limit_vnd: null,
            required_fields: [],
            note: "Soạn nháp tự do.",
        },
        {
            department: "content",
            action: "publish_post",
            mode: "ask",
            limit_vnd: null,
            required_fields: [],
            note: "Mọi bài đăng cần quản lý duyệt.",
        },
        {
            department: "video",
            action: "render_draft",
            mode: "auto",
            limit_vnd: null,
            required_fields: [],
            note: "Dựng nháp tự do.",
        },
        {
            department: "video",
            action: "publish_video",
            mode: "ask",
            limit_vnd: null,
            required_fields: [],
            note: "Video đăng công khai cần duyệt.",
        },
        {
            department: "chatbot",
            action: "reply_customer",
            mode: "auto",
            limit_vnd: null,
            required_fields: [],
            note: "Trả lời trong chính sách đã có.",
        },
        {
            department: "chatbot",
            action: "handoff_lead",
            mode: "auto",
            limit_vnd: null,
            required_fields: ["contact_name", "need"],
            note: "Chuyển lễ tân khi ngoài chính sách.",
        },
        {
            department: "booking",
            action: "confirm_booking",
            mode: "auto",
            limit_vnd: null,
            required_fields: ["contact"],
            note: "Giá khác báo giá của HAKUEN cần quản lý duyệt.",
        },
        {
            department: "booking",
            action: "cancel_with_fee",
            mode: "ask",
            limit_vnd: null,
            required_fields: [],
            note: "Thu phí hủy cần quản lý duyệt.",
        },
        {
            department: "accounting",
            action: "issue_invoice",
            mode: "auto",
            limit_vnd: 20_000_000,
            required_fields: ["customer", "amount_vnd"],
            note: "Từ 20.000.000 ₫ cần kế toán trưởng duyệt.",
        },
        {
            department: "accounting",
            action: "reconcile_payment",
            mode: "auto",
            limit_vnd: 50_000_000,
            required_fields: ["amount_vnd"],
            note: "Khớp tự động dưới 50.000.000 ₫.",
        },
        {
            department: "accounting",
            action: "send_email",
            mode: "ask",
            limit_vnd: null,
            required_fields: ["contact"],
            note: "Email cho khách cần duyệt.",
        },
    ],
    documents: HAKUEN_DOCUMENTS,
}
