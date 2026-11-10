import type { BilingualText } from "../messages/catalog"
import { TOOL } from "./tool-ids"

/** What a tool does to the business: `acts` changes something or says something to someone, `reads` only looks. */
export type ToolLabelKind = "acts" | "reads"

/**
 * One tool as the shop owner reads it on an agent's page: a short title and one line in the shop's words, never the long description
 * the model reads.
 */
export interface ToolLabel {
    /** Whether the tool changes something (`acts`) or only reads (`reads`). */
    readonly kind: ToolLabelKind
    /** The name of the tool, a few words. */
    readonly title: BilingualText
    /** What it lets the agent do, one short line. */
    readonly summary: BilingualText
}

const acts = (title: BilingualText, summary: BilingualText): ToolLabel => ({ kind: "acts", title, summary })
const reads = (title: BilingualText, summary: BilingualText): ToolLabel => ({ kind: "reads", title, summary })

/**
 * The owner-facing words of every tool an agent can hold: the step tools of the vocabulary (keyed by `TOOL`, so a rename moves them
 * along) and the provider tools an ability on a connected account gives. A tool missing here is shown by its id.
 */
export const TOOL_LABELS: Readonly<Record<string, ToolLabel>> = {
    [TOOL.customerMessageSend]: acts(
        { vi: "Nhắn khách", en: "Message a customer" },
        { vi: "Trả lời khách trong cuộc trò chuyện của họ.", en: "Replies to a customer in their conversation." },
    ),
    [TOOL.careSchedule]: acts(
        { vi: "Hẹn chăm sóc khách", en: "Schedule customer care" },
        { vi: "Hẹn một lần nhắn chăm sóc khách vào lúc sau.", en: "Plans a care message to a customer for later." },
    ),
    [TOOL.leadEnsure]: acts(
        { vi: "Ghi nhận khách", en: "Record a customer" },
        { vi: "Tìm hoặc tạo hồ sơ khách của cuộc trò chuyện.", en: "Finds or creates the customer of a conversation." },
    ),
    [TOOL.leadUpdate]: acts(
        { vi: "Cập nhật hồ sơ khách", en: "Update a customer" },
        { vi: "Ghi thêm điều đã biết về khách.", en: "Notes what is known about a customer." },
    ),
    [TOOL.leadStageUpdate]: acts(
        { vi: "Chuyển giai đoạn khách", en: "Move a deal" },
        { vi: "Chuyển khách sang giai đoạn khác (chốt, mất...).", en: "Moves a customer's deal to another stage (won, lost...)." },
    ),
    [TOOL.orderRecord]: acts(
        { vi: "Tạo đơn", en: "Create an order" },
        { vi: "Tạo đơn cho khách, giá lấy từ danh mục.", en: "Creates a customer's order, priced from the catalogue." },
    ),
    [TOOL.orderConfirm]: acts(
        { vi: "Xác nhận đơn", en: "Confirm an order" },
        { vi: "Xác nhận một đơn nháp.", en: "Confirms a draft order." },
    ),
    [TOOL.orderVoid]: acts(
        { vi: "Huỷ đơn", en: "Cancel an order" },
        { vi: "Huỷ một đơn đã tạo.", en: "Cancels an order that was created." },
    ),
    [TOOL.paymentQrCreate]: acts(
        { vi: "Gửi mã QR thanh toán", en: "Send a payment QR" },
        {
            vi: "Gửi khách số tài khoản và mã QR của đơn đã xác nhận.",
            en: "Sends the customer the bank details and QR of a confirmed order.",
        },
    ),
    [TOOL.paymentMarkPaid]: acts(
        { vi: "Ghi nhận đã trả", en: "Mark an order paid" },
        { vi: "Đánh dấu đơn đã trả theo giao dịch ngân hàng.", en: "Marks an order paid by a bank credit." },
    ),
    [TOOL.paymentRematch]: acts(
        { vi: "Dò lại tiền về", en: "Rematch a credit" },
        {
            vi: "Tìm lại khoản tiền về trước khi đơn có mã thanh toán.",
            en: "Looks again for a credit that arrived before the order had a code.",
        },
    ),
    [TOOL.paymentClaimRecord]: acts(
        { vi: "Ghi lời báo đã chuyển", en: "Record a payment claim" },
        { vi: "Ghi lại việc khách báo đã chuyển tiền.", en: "Records that a customer said they paid." },
    ),
    [TOOL.paymentClaimWithdraw]: acts(
        { vi: "Bỏ lời báo đã chuyển", en: "Withdraw a payment claim" },
        { vi: "Bỏ một lời báo đã chuyển đã ghi.", en: "Withdraws a recorded payment claim." },
    ),
    [TOOL.teamMessagePost]: acts(
        { vi: "Nhắn đội", en: "Message the team" },
        { vi: "Nhắn đội trong /chat.", en: "Posts to the team in /chat." },
    ),
    [TOOL.agentTag]: acts(
        { vi: "Chuyển cho agent khác", en: "Hand over to an agent" },
        { vi: "Chuyển cuộc trò chuyện hoặc việc cho agent khác.", en: "Hands a conversation or a record to another agent." },
    ),
    [TOOL.workItemRaise]: acts(
        { vi: "Hỏi người quyết định", en: "Ask a person to decide" },
        { vi: "Tạo việc cần một người quyết định.", en: "Raises an item a person decides." },
    ),
    [TOOL.workItemWithdraw]: acts(
        { vi: "Rút việc cần quyết định", en: "Withdraw a decision item" },
        { vi: "Rút lại một việc đã nhờ người quyết định.", en: "Withdraws an item raised for a person." },
    ),
    [TOOL.reportDailyClose]: acts(
        { vi: "Chốt ngày", en: "Close the day" },
        { vi: "Tính số liệu trong ngày và gửi báo cáo.", en: "Computes the day's figures and posts the report." },
    ),
    [TOOL.ledgerAppend]: acts(
        { vi: "Ghi sổ", en: "Write to the ledger" },
        { vi: "Thêm một dòng vào sổ sách của tiệm.", en: "Adds an entry to the shop's ledger." },
    ),
    [TOOL.ledgerVoid]: acts(
        { vi: "Bỏ dòng sổ", en: "Void a ledger entry" },
        { vi: "Bỏ một dòng đã ghi trong sổ.", en: "Takes a ledger entry back." },
    ),
    [TOOL.ledgerStatus]: reads(
        { vi: "Xem sổ đã nối chưa", en: "Check the ledger" },
        { vi: "Xem sổ sách đã được nối chưa.", en: "Checks whether a ledger is connected." },
    ),
    [TOOL.bankTransactions]: reads(
        { vi: "Đọc giao dịch ngân hàng", en: "Read bank transactions" },
        { vi: "Đọc tiền vào, tiền ra của tài khoản được gắn.", en: "Reads the movements of the attached bank accounts." },
    ),
    [TOOL.brainSearch]: reads(
        { vi: "Tra cứu hiểu biết của tiệm", en: "Search what the shop knows" },
        { vi: "Tìm trong quy định và tài liệu của tiệm.", en: "Searches the shop's facts and documents." },
    ),
    [TOOL.brainFactGet]: reads(
        { vi: "Xem một sự thật của tiệm", en: "Read one truth" },
        { vi: "Xem một sự thật đang hiệu lực, nguồn và phiên bản của nó.", en: "Reads one truth in force with its evidence and version." },
    ),
    [TOOL.brainFactRelated]: reads(
        { vi: "Xem sự thật liên quan", en: "Read related truths" },
        { vi: "Xem các sự thật được nối với một sự thật.", en: "Reads the truths linked to one truth." },
    ),
    [TOOL.brainChangePropose]: acts(
        { vi: "Đề nghị sửa sự thật", en: "Propose a change to a truth" },
        { vi: "Gửi chủ tiệm đề nghị sửa; chủ duyệt mới có hiệu lực.", en: "Files a change for the founder; in force only once approved." },
    ),
    [TOOL.conversationMessageList]: reads(
        { vi: "Đọc cuộc trò chuyện", en: "Read the conversation" },
        { vi: "Đọc các tin nhắn gần đây của cuộc trò chuyện đang xử lý.", en: "Reads the latest lines of the conversation it serves." },
    ),
    [TOOL.leadProfileGet]: reads(
        { vi: "Xem hồ sơ khách", en: "Read the customer" },
        { vi: "Xem hồ sơ của khách đang xử lý.", en: "Reads the record of the customer it serves." },
    ),
    [TOOL.leadOrderList]: reads(
        { vi: "Xem đơn của khách", en: "Read the customer's orders" },
        { vi: "Xem các đơn gần đây của khách đang xử lý.", en: "Reads the latest orders of the customer it serves." },
    ),
    [TOOL.leadNoteList]: reads(
        { vi: "Xem ghi chú về khách", en: "Read notes on the customer" },
        { vi: "Xem điều tiệm đã ghi về khách đang xử lý.", en: "Reads what the shop noted about the customer it serves." },
    ),
    "sepay.transactions.list": reads(
        { vi: "Đọc giao dịch SePay", en: "Read SePay transactions" },
        { vi: "Đọc các khoản tiền vào qua SePay.", en: "Reads the credits SePay reports." },
    ),
    "sepay.transactions.debits": reads(
        { vi: "Đọc tiền ra SePay", en: "Read SePay debits" },
        { vi: "Đọc các khoản tiền ra qua SePay.", en: "Reads the debits SePay reports." },
    ),
    "sepay.status": reads(
        { vi: "Xem trạng thái SePay", en: "Check SePay" },
        { vi: "Xem kết nối SePay có đang chạy không.", en: "Checks whether the SePay connection works." },
    ),
    "drive.status": reads(
        { vi: "Xem trạng thái Google Drive", en: "Check Google Drive" },
        { vi: "Xem Google Drive đã nối chưa.", en: "Checks whether Google Drive is connected." },
    ),
    "drive.sources.list": reads(
        { vi: "Xem tài liệu trên Drive", en: "List Drive documents" },
        { vi: "Liệt kê tài liệu Drive tiệm đã chọn.", en: "Lists the Drive documents the shop chose." },
    ),
}

/** The owner-facing words of a tool, or null for a tool this file does not name. */
export const toolLabelOf = (tool: string): ToolLabel | null => (Object.hasOwn(TOOL_LABELS, tool) ? TOOL_LABELS[tool] ?? null : null)
