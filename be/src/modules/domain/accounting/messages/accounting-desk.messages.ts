import type { DailySummaryInput, EinvoiceIssue, ObligationKind, UpcomingDue } from "../accounting-desk.contracts"

/** The legal basis printed with each statutory deadline (Vietnamese, as the reminder shows it). */
export const TAX_BASIS = {
    vatMonthly: "Luật QLT 38/2019 Đ.44.1.a: ngày 20 tháng sau",
    vatQuarterly: "Luật QLT 38/2019 Đ.44.1.b: ngày cuối tháng đầu quý sau",
    citProvisional: "NĐ 126/2020 Đ.8, NĐ 91/2022: ngày 30 tháng đầu quý sau",
    finalization: "Luật QLT 38/2019 Đ.44.2: ngày cuối tháng thứ 3 sau năm tài chính",
    licenseFee: "NĐ 126/2020 Đ.10.9: ngày 30/01",
} as const

/** The label of each obligation (Vietnamese, the Kế toán room language). */
export const KIND_LABELS: ReadonlyMap<ObligationKind | "supplier_payment", string> = new Map([
    ["vat", "Thuế GTGT"],
    ["pit", "Thuế TNCN khấu trừ"],
    ["cit_provisional", "Tạm nộp thuế TNDN"],
    ["cit_finalization", "Quyết toán thuế TNDN"],
    ["pit_finalization", "Quyết toán thuế TNCN"],
    ["license_fee", "Lệ phí môn bài"],
    ["supplier_payment", "Thanh toán NCC"],
])

/** The sentences of the `daily_summary` card and the reminders. */
export const SUMMARY_COPY = {
    headline: (exceptions: number): string =>
        exceptions === 0
            ? "Đã kiểm tra chứng từ và đối soát đầu ngày. Không có ngoại lệ."
            : `Đã kiểm tra chứng từ và đối soát đầu ngày. Có ${exceptions} ngoại lệ cần Kế toán trưởng quyết định.`,
    stats: (input: DailySummaryInput): string =>
        `Chứng từ hợp lệ: ${input.valid} · Cần xem lại: ${input.needsReview} · Sai mã số thuế: ${input.invalidTaxCode}`,
    bank: (input: DailySummaryInput): string =>
        `Ngân hàng: ${input.matched} giao dịch đã khớp · ${input.unmatched} khoản tiền vào chờ xác minh`,
    next: (due: UpcomingDue, label: string): string =>
        `Hạn sắp tới: ${label} ${due.ref}, ${due.dueOn} (còn ${due.daysLeft} ngày)`,
    none: "Không có hạn nào trong 30 ngày tới.",
    reminder: (line: string, note: string): string => `Nhắc hạn · ${line} · ${note}`,
} as const

/** Why an invoice was raised. */
export const ISSUE_TEXT: ReadonlyMap<EinvoiceIssue, string> = new Map([
    ["seller_tax_code_format", "Mã số thuế người bán không hợp lệ (sai định dạng hoặc số kiểm tra)."],
    ["seller_tax_code_mismatch", "Mã số thuế trên hóa đơn chưa khớp hồ sơ nhà cung cấp."],
    ["buyer_tax_code_mismatch", "Mã số thuế người mua không phải của doanh nghiệp."],
    ["subtotal_mismatch", "Tổng tiền hàng không bằng tổng các dòng."],
    ["vat_mismatch", "Tiền thuế GTGT không khớp thuế suất từng dòng."],
    ["total_mismatch", "Tổng thanh toán không bằng tiền hàng cộng thuế."],
    ["vat_rate_invalid", "Thuế suất GTGT không thuộc mức hiện hành."],
    ["missing_fields", "Hóa đơn thiếu số, mã số thuế người bán hoặc tổng tiền."],
])

/** The pieces of the exception line of an invoice. */
export const EXCEPTION_COPY = {
    head: (seller: string, invoiceNo: string, total: number): string =>
        `Kiểm tra hóa đơn · ${seller || "(không rõ người bán)"} · HĐ ${invoiceNo || "?"} · ${total.toLocaleString("vi-VN")} ₫`,
    proposeTaxCode: "Đề xuất: giữ chứng từ để kiểm tra, yêu cầu nhà cung cấp điều chỉnh MST trước khi ghi nhận.",
    proposeReview: "Đề xuất: giữ chứng từ, đối chiếu lại với nhà cung cấp trước khi ghi nhận.",
    onInvoice: (code: string): string => `Trên hóa đơn: ${code}`,
    onFile: (code: string, file: string): string => `Trên hóa đơn: ${code} · Hồ sơ: ${file}`,
} as const

/** The labels of the hub cards. */
export const CARD_COPY = {
    summaryTitle: "Tổng hợp đầu ngày",
    valid: "Chứng từ hợp lệ",
    needsReview: "Cần xem lại",
    invalidTaxCode: "Sai mã số thuế",
    matched: "Giao dịch đã khớp",
    unmatched: "Tiền vào chờ xác minh",
    dueAt: (due: UpcomingDue, label: string): string => `${label} ${due.ref} · còn ${due.daysLeft} ngày`,
    invoiceTitle: (seller: string): string => `Kiểm tra hóa đơn · ${seller || "(không rõ người bán)"}`,
    badgeTaxCode: "Sai MST",
    badgeReview: "Cần xem",
    invoiceNo: "Hóa đơn",
    total: "Tổng thanh toán",
    onInvoice: "MST trên hóa đơn",
    onFile: "MST hồ sơ",
    money: (amount: number): string => `${amount.toLocaleString("vi-VN")} ₫`,
    sourceInvoices: "Hóa đơn điện tử",
    sourceCredits: "Giao dịch ngân hàng",
    sourceReceivables: "Khoản phải thu",
    sourceDebits: "Khoản chi ngân hàng",
    toolSource: (label: string, tool: string): string => `${label} · ${tool}`,
    notConnected: (label: string): string => `${label}: chưa kết nối`,
    sourceTaxProfile: "Hồ sơ thuế của doanh nghiệp",
    sourceTaxCalendar: "Lịch thuế Việt Nam",
    sourceSupplier: "Hồ sơ nhà cung cấp",
} as const

/** The badge of a receivable payment that is not exact. */
export const RECEIVABLE_MATCH_TEXT: ReadonlyMap<string, string> = new Map([
    ["partial", "Thanh toán thiếu"],
    ["over", "Thanh toán thừa"],
    ["settled", "Khoản phải thu đã tất toán"],
])

/** The lines of the receivable reconciliation (N23); the memo is quoted as the payer wrote it. */
export const RECEIVABLE_COPY = {
    recorded: (memo: string, amount: number, ref: string): string =>
        `Đã khớp tiền vào ${amount.toLocaleString("vi-VN")} ₫ ("${memo}") với khoản phải thu và đã ghi nhận · ${ref}`,
    failed: (memo: string, ref: string): string =>
        `Chưa ghi nhận được thanh toán "${memo}" vào khoản phải thu · ${ref}. Kế toán kiểm tra lại.`,
    title: (memo: string): string => `Đối soát thanh toán · ${memo}`,
    body: "Đề xuất: Kế toán trưởng xác nhận số tiền trước khi ghi nhận vào khoản phải thu.",
    received: "Tiền vào",
    balance: "Còn phải thu",
    memo: "Nội dung chuyển khoản",
    text: (memo: string, amount: number, balance: number): string =>
        `Đối soát thanh toán "${memo}": tiền vào ${amount.toLocaleString("vi-VN")} ₫, còn phải thu ${balance.toLocaleString("vi-VN")} ₫. Cần Kế toán trưởng xác nhận.`,
} as const

/** The lines of the supplier payment matching: an outgoing payment that only partly matches an open supplier invoice. */
export const SUPPLIER_COPY = {
    title: (supplier: string, invoiceNo: string): string => `Đối chiếu thanh toán NCC · ${supplier || "(không rõ)"} · HĐ ${invoiceNo}`,
    badge: "Cần xác nhận",
    body: "Đề xuất: Kế toán trưởng xác nhận khoản chi này đã trả hóa đơn; khi xác nhận, hóa đơn không còn được nhắc hạn.",
    invoiceAmount: "Hóa đơn",
    paid: "Đã chi",
    memo: "Nội dung chuyển khoản",
    text: (supplier: string, invoiceNo: string, invoice: number, paid: number): string =>
        `Đối chiếu thanh toán ${supplier || "NCC"} · HĐ ${invoiceNo}: hóa đơn ${invoice.toLocaleString("vi-VN")} ₫, đã chi ${paid.toLocaleString("vi-VN")} ₫. Cần Kế toán trưởng xác nhận.`,
} as const

/** The text of one invoice issue. */
export const issueText = (issue: EinvoiceIssue): string => ISSUE_TEXT.get(issue) ?? issue

/** The label of one obligation. */
export const kindText = (kind: ObligationKind | "supplier_payment"): string => KIND_LABELS.get(kind) ?? kind

/** The badge of a receivable payment that is not exact. */
export const receivableMatchText = (match: string): string => RECEIVABLE_MATCH_TEXT.get(match) ?? match
