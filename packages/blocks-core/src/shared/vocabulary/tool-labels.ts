import type { BilingualText } from "../messages/catalog"
import { ENGINE_TOOL_LABELS } from "@nivo-lite/agent-sdk/names"
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
 * The owner-facing words of every tool an agent can hold, keyed by `TOOL` so a rename moves them along: the step tools of the vocabulary,
 * the platform purposes a provider serves as an adapter (no label names a provider as a tool's owner) and the customer purposes of the
 * business system. A tool missing here is shown by its id.
 */
export const TOOL_LABELS: Readonly<Record<string, ToolLabel>> = {
    // The words of the engine's own native tools are the engine's (`ENGINE_TOOL_LABELS` of agent-sdk); joined here so the installation lists every tool.
    ...ENGINE_TOOL_LABELS,
    [TOOL.customerMessageSend]: acts(
        { vi: "Nh\u1eafn kh\u00e1ch", en: "Message a customer" },
        { vi: "Tr\u1ea3 l\u1eddi kh\u00e1ch trong cu\u1ed9c tr\u00f2 chuy\u1ec7n c\u1ee7a h\u1ecd.", en: "Replies to a customer in their conversation." },
    ),
    [TOOL.teamMessagePost]: acts(
        { vi: "Nh\u1eafn \u0111\u1ed9i", en: "Message the team" },
        { vi: "Nh\u1eafn \u0111\u1ed9i trong /chat.", en: "Posts to the team in /chat." },
    ),
    [TOOL.agentTag]: acts(
        { vi: "Chuy\u1ec3n cho agent kh\u00e1c", en: "Hand over to an agent" },
        { vi: "Chuy\u1ec3n cu\u1ed9c tr\u00f2 chuy\u1ec7n ho\u1eb7c vi\u1ec7c cho agent kh\u00e1c.", en: "Hands a conversation or a record to another agent." },
    ),
    [TOOL.ledgerEntryAppend]: acts(
        { vi: "Ghi s\u1ed5", en: "Write to the ledger" },
        { vi: "Th\u00eam m\u1ed9t d\u00f2ng v\u00e0o s\u1ed5 s\u00e1ch c\u1ee7a ti\u1ec7m.", en: "Adds an entry to the shop's ledger." },
    ),
    [TOOL.ledgerEntryVoid]: acts(
        { vi: "B\u1ecf d\u00f2ng s\u1ed5", en: "Void a ledger entry" },
        { vi: "B\u1ecf m\u1ed9t d\u00f2ng \u0111\u00e3 ghi trong s\u1ed5.", en: "Takes a ledger entry back." },
    ),
    [TOOL.ledgerStatusGet]: reads(
        { vi: "Xem s\u1ed5 \u0111\u00e3 n\u1ed1i ch\u01b0a", en: "Check the ledger" },
        { vi: "Xem s\u1ed5 s\u00e1ch \u0111\u00e3 \u0111\u01b0\u1ee3c n\u1ed1i ch\u01b0a.", en: "Checks whether a ledger is connected." },
    ),
    [TOOL.bankTransactionList]: reads(
        { vi: "\u0110\u1ecdc giao d\u1ecbch ng\u00e2n h\u00e0ng", en: "Read bank transactions" },
        { vi: "\u0110\u1ecdc ti\u1ec1n v\u00e0o, ti\u1ec1n ra c\u1ee7a t\u00e0i kho\u1ea3n \u0111\u01b0\u1ee3c g\u1eafn.", en: "Reads the movements of the attached bank accounts." },
    ),
    [TOOL.brainSearch]: reads(
        { vi: "Tra c\u1ee9u s\u1ef1 th\u1eadt c\u1ee7a ti\u1ec7m", en: "Search the shop's truths" },
        { vi: "T\u00ecm c\u00e1c s\u1ef1 th\u1eadt \u0111ang hi\u1ec7u l\u1ef1c c\u1ee7a ti\u1ec7m.", en: "Searches the shop's truths in force." },
    ),
    [TOOL.brainFactGet]: reads(
        { vi: "Xem m\u1ed9t s\u1ef1 th\u1eadt c\u1ee7a ti\u1ec7m", en: "Read one truth" },
        { vi: "Xem m\u1ed9t s\u1ef1 th\u1eadt \u0111ang hi\u1ec7u l\u1ef1c, ngu\u1ed3n v\u00e0 phi\u00ean b\u1ea3n c\u1ee7a n\u00f3.", en: "Reads one truth in force with its evidence and version." },
    ),
    [TOOL.brainFactRelated]: reads(
        { vi: "Xem s\u1ef1 th\u1eadt li\u00ean quan", en: "Read related truths" },
        { vi: "Xem c\u00e1c s\u1ef1 th\u1eadt \u0111\u01b0\u1ee3c n\u1ed1i v\u1edbi m\u1ed9t s\u1ef1 th\u1eadt.", en: "Reads the truths linked to one truth." },
    ),
    [TOOL.brainPassageSearch]: reads(
        { vi: "T\u00ecm trong t\u00e0i li\u1ec7u", en: "Search the documents" },
        { vi: "T\u00ecm \u0111o\u1ea1n li\u00ean quan trong t\u00e0i li\u1ec7u c\u1ee7a ti\u1ec7m.", en: "Finds passages in the shop's documents." },
    ),
    [TOOL.brainPassageRead]: reads(
        { vi: "\u0110\u1ecdc \u0111o\u1ea1n t\u00e0i li\u1ec7u", en: "Read a document passage" },
        { vi: "\u0110\u1ecdc tr\u1ecdn m\u1ed9t \u0111o\u1ea1n t\u00e0i li\u1ec7u v\u00e0 c\u00e1c \u0111o\u1ea1n k\u1ec1.", en: "Reads a document passage with its neighbours." },
    ),
    [TOOL.brainChangePropose]: acts(
        { vi: "\u0110\u1ec1 ngh\u1ecb s\u1eeda s\u1ef1 th\u1eadt", en: "Propose a change to a truth" },
        { vi: "G\u1eedi ch\u1ee7 ti\u1ec7m \u0111\u1ec1 ngh\u1ecb s\u1eeda; ch\u1ee7 duy\u1ec7t m\u1edbi c\u00f3 hi\u1ec7u l\u1ef1c.", en: "Files a change for the founder; in force only once approved." },
    ),
    [TOOL.leadOrderList]: reads(
        { vi: "Xem \u0111\u01a1n c\u1ee7a kh\u00e1ch", en: "Read the customer's orders" },
        { vi: "Xem c\u00e1c \u0111\u01a1n g\u1ea7n \u0111\u00e2y c\u1ee7a kh\u00e1ch \u0111ang x\u1eed l\u00fd.", en: "Reads the latest orders of the customer it serves." },
    ),
    [TOOL.paymentCreditList]: reads(
        { vi: "\u0110\u1ecdc ti\u1ec1n v\u00e0o", en: "Read received credits" },
        { vi: "\u0110\u1ecdc c\u00e1c kho\u1ea3n ti\u1ec1n v\u00e0o t\u00e0i kho\u1ea3n ng\u00e2n h\u00e0ng \u0111\u01b0\u1ee3c g\u1eafn.", en: "Reads the credits received on the attached bank accounts." },
    ),
    [TOOL.paymentCreditGet]: reads(
        { vi: "Xem m\u1ed9t kho\u1ea3n ti\u1ec1n v\u00e0o", en: "Read one bank credit" },
        {
            vi: "Xem m\u1ed9t kho\u1ea3n ti\u1ec1n v\u00e0o ho\u1eb7c ra c\u1ee7a t\u00e0i kho\u1ea3n ng\u00e2n h\u00e0ng \u0111\u01b0\u1ee3c g\u1eafn theo m\u00e3 giao d\u1ecbch: s\u1ed1 ti\u1ec1n, n\u1ed9i dung, th\u1eddi \u0111i\u1ec3m; m\u1ecdi ngu\u1ed3n ng\u00e2n h\u00e0ng tr\u1ea3 c\u00f9ng m\u1ed9t d\u1ea1ng.",
            en: "Reads one bank move of the attached bank account by its id: amount, content and time; every bank feed answers the same shape.",
        },
    ),
    [TOOL.paymentDebitList]: reads(
        { vi: "\u0110\u1ecdc ti\u1ec1n ra", en: "Read debits" },
        { vi: "\u0110\u1ecdc c\u00e1c kho\u1ea3n ti\u1ec1n ra kh\u1ecfi t\u00e0i kho\u1ea3n ng\u00e2n h\u00e0ng \u0111\u01b0\u1ee3c g\u1eafn.", en: "Reads the money that went out of the attached bank accounts." },
    ),
    [TOOL.connectionStatusGet]: reads(
        { vi: "Xem tr\u1ea1ng th\u00e1i k\u1ebft n\u1ed1i", en: "Check a connection" },
        { vi: "Xem c\u00e1c t\u00e0i kho\u1ea3n \u0111\u00e3 n\u1ed1i c\u00f3 \u0111ang ch\u1ea1y kh\u00f4ng.", en: "Checks whether the connected accounts work." },
    ),
    [TOOL.driveSourceList]: reads(
        { vi: "Xem t\u00e0i li\u1ec7u ngu\u1ed3n", en: "List source documents" },
        { vi: "Li\u1ec7t k\u00ea t\u00e0i li\u1ec7u ti\u1ec7m \u0111\u00e3 ch\u1ecdn tr\u00ean \u1ed5 l\u01b0u tr\u1eef \u0111\u01b0\u1ee3c n\u1ed1i.", en: "Lists the documents the shop chose on a connected drive." },
    ),
    [TOOL.invoiceCreate]: acts(
        { vi: "Xu\u1ea5t ho\u00e1 \u0111\u01a1n", en: "Issue an invoice" },
        { vi: "Xu\u1ea5t m\u1ed9t ho\u00e1 \u0111\u01a1n \u0111i\u1ec7n t\u1eed; lu\u00f4n h\u1ecfi ng\u01b0\u1eddi tr\u01b0\u1edbc.", en: "Issues an e-invoice; always asks a person first." },
    ),
    [TOOL.leadCareGet]: reads(
        { vi: "Xem ch\u0103m s\u00f3c kh\u00e1ch", en: "Read customer care" },
        { vi: "Xem kh\u00e1ch c\u00f3 t\u1eeb ch\u1ed1i nh\u1eadn tin kh\u00f4ng v\u00e0 c\u00e1c d\u1ecbp c\u1ee7a kh\u00e1ch.", en: "Reads whether the customer opted out and their occasions." },
    ),
    [TOOL.orderGet]: reads(
        { vi: "Xem m\u1ed9t \u0111\u01a1n", en: "Read an order" },
        { vi: "Xem m\u1ed9t \u0111\u01a1n h\u00e0ng v\u1edbi c\u00e1c d\u00f2ng v\u00e0 t\u00ecnh tr\u1ea1ng thanh to\u00e1n.", en: "Reads one order with its lines and its payment state." },
    ),
    [TOOL.orderOpenList]: reads(
        { vi: "Xem \u0111\u01a1n ch\u1edd thanh to\u00e1n", en: "List unpaid orders" },
        { vi: "Li\u1ec7t k\u00ea c\u00e1c \u0111\u01a1n \u0111ang ch\u1edd thanh to\u00e1n.", en: "Lists the orders awaiting payment." },
    ),
    [TOOL.paymentClaimList]: reads(
        { vi: "Xem kh\u00e1ch b\u00e1o \u0111\u00e3 tr\u1ea3", en: "List payment claims" },
        { vi: "Xem nh\u1eefng l\u1ea7n kh\u00e1ch n\u00f3i \u0111\u00e3 chuy\u1ec3n ti\u1ec1n.", en: "Lists what a customer said they paid." },
    ),
    [TOOL.paymentTransferCreate]: reads(
        { vi: "T\u1ea1o th\u00f4ng tin chuy\u1ec3n kho\u1ea3n", en: "Create a bank-transfer instruction" },
        { vi: "L\u1eadp m\u00e3 QR v\u00e0 s\u1ed1 t\u00e0i kho\u1ea3n \u0111\u1ec3 kh\u00e1ch chuy\u1ec3n kho\u1ea3n \u0111\u00fang s\u1ed1 ti\u1ec1n v\u00e0 n\u1ed9i dung; ch\u1ec9 l\u1eadp th\u00f4ng tin, kh\u00f4ng chuy\u1ec3n hay ghi nh\u1eadn ti\u1ec1n.", en: "Makes the QR and account details for a customer to transfer an amount with a content; it only makes the instruction and moves or records no money." },
    ),
    [TOOL.paymentLinkCreate]: acts(
        { vi: "T\u1ea1o link thanh to\u00e1n", en: "Create a payment link" },
        { vi: "T\u1ea1o m\u1ed9t link thanh to\u00e1n c\u00f3 m\u00e3 \u0111\u01a1n ri\u00eang c\u1ee7a nh\u00e0 cung c\u1ea5p \u0111\u1ec3 kh\u00e1ch tr\u1ea3 \u0111\u00fang s\u1ed1 ti\u1ec1n; ch\u1ec9 t\u1ea1o link, kh\u00f4ng chuy\u1ec3n hay ghi nh\u1eadn ti\u1ec1n.", en: "Creates a payment link under the provider's own order code for a customer to pay an amount; it only creates the link and moves or records no money." },
    ),
    [TOOL.paymentLinkGet]: reads(
        { vi: "Xem link thanh to\u00e1n", en: "Read a payment link" },
        { vi: "Xem m\u1ed9t link thanh to\u00e1n theo m\u00e3 link ho\u1eb7c m\u00e3 \u0111\u01a1n: t\u00ecnh tr\u1ea1ng v\u00e0 s\u1ed1 ti\u1ec1n \u0111\u00e3 tr\u1ea3.", en: "Reads one payment link by its id or order code: its status and the amount paid." },
    ),
    [TOOL.paymentLinkCancel]: acts(
        { vi: "Hu\u1ef7 link thanh to\u00e1n", en: "Cancel a payment link" },
        { vi: "Hu\u1ef7 m\u1ed9t link thanh to\u00e1n theo m\u00e3 link ho\u1eb7c m\u00e3 \u0111\u01a1n, k\u00e8m l\u00fd do n\u1ebfu c\u00f3.", en: "Cancels a payment link by its id or order code, with a reason when given." },
    ),
    [TOOL.timerArm]: acts(
        { vi: "H\u1eb9n gi\u1edd", en: "Arm a timer" },
        { vi: "H\u1eb9n m\u1ed9t th\u1eddi \u0111i\u1ec3m \u0111\u1ec3 \u0111\u00e1nh th\u1ee9c l\u1ea1i ch\u00ednh quy tr\u00ecnh n\u00e0y cho \u0111\u00fang kh\u00e1ch; h\u1eb9n l\u1ea1i c\u00f9ng m\u00e3 th\u00ec \u0111\u1ed5i th\u1eddi \u0111i\u1ec3m.", en: "Sets a moment to wake this agent again about the same customer; arming the same ref again moves the moment." },
    ),
    [TOOL.timerCancel]: acts(
        { vi: "Hu\u1ef7 h\u1eb9n gi\u1edd", en: "Cancel a timer" },
        { vi: "Hu\u1ef7 m\u1ed9t l\u1ecbch h\u1eb9n gi\u1edd \u0111\u00e3 \u0111\u1eb7t theo m\u00e3.", en: "Cancels a timer armed earlier, by its ref." },
    ),
    [TOOL.mailMessageSend]: acts(
        { vi: "G\u1eedi th\u01b0", en: "Send a mail" },
        { vi: "G\u1eedi m\u1ed9t th\u01b0 qua h\u1ed9p th\u01b0 g\u1eedi \u0111\u01b0\u1ee3c n\u1ed1i; c\u00f3 h\u1ecfi ng\u01b0\u1eddi tr\u01b0\u1edbc hay kh\u00f4ng l\u00e0 do ch\u1ebf \u0111\u1ed9 c\u1ee7a b\u01b0\u1edbc.", en: "Sends a mail through the connected outgoing mailbox; whether a person is asked first is the step's mode." },
    ),
    [TOOL.driveStatusGet]: reads(
        { vi: "Xem tr\u1ea1ng th\u00e1i \u1ed5 l\u01b0u tr\u1eef", en: "Check the drive" },
        { vi: "Xem \u1ed5 l\u01b0u tr\u1eef \u0111\u00e3 n\u1ed1i c\u00f3 \u0111ang ch\u1ea1y kh\u00f4ng.", en: "Checks whether the connected drive works." },
    ),
    [TOOL.brainFactList]: reads(
        { vi: "Xem c\u00e1c \u0111i\u1ec1u \u0111\u00fang", en: "List the truths" },
        { vi: "Li\u1ec7t k\u00ea c\u00e1c \u0111i\u1ec1u \u0111\u00fang \u0111ang c\u00f3 hi\u1ec7u l\u1ef1c c\u1ee7a ti\u1ec7m.", en: "Lists the shop's truths in force." },
    ),
    [TOOL.brainDocumentRead]: reads(
        { vi: "\u0110\u1ecdc t\u00e0i li\u1ec7u", en: "Read a document" },
        { vi: "\u0110\u1ecdc m\u1ed9t t\u00e0i li\u1ec7u c\u1ee7a ti\u1ec7m.", en: "Reads one of the shop's documents." },
    ),
    [TOOL.teamChatReportPost]: acts(
        { vi: "\u0110\u0103ng b\u00e1o c\u00e1o cho \u0111\u1ed9i", en: "Post a report to the team" },
        { vi: "\u0110\u0103ng m\u1ed9t th\u1ebb b\u00e1o c\u00e1o v\u00e0o tr\u00f2 chuy\u1ec7n c\u1ee7a \u0111\u1ed9i.", en: "Posts a report card to the team chat." },
    ),
    [TOOL.domainAvailabilityGet]: reads(
        { vi: "Ki\u1ec3m tra t\u00ean mi\u1ec1n c\u00f2n tr\u1ed1ng", en: "Check a domain name" },
        { vi: "Xem m\u1ed9t t\u00ean mi\u1ec1n c\u00f2n \u0111\u0103ng k\u00fd \u0111\u01b0\u1ee3c kh\u00f4ng v\u00e0 gi\u00e1 theo t\u1eebng k\u1ef3.", en: "Checks whether a domain name can be registered, with its prices per period." },
    ),
    [TOOL.domainGet]: reads(
        { vi: "Xem t\u00ean mi\u1ec1n", en: "Read a domain" },
        { vi: "Xem tr\u1ea1ng th\u00e1i, ng\u00e0y h\u1ebft h\u1ea1n, nameserver v\u00e0 t\u1ef1 gia h\u1ea1n c\u1ee7a m\u1ed9t t\u00ean mi\u1ec1n \u0111ang gi\u1eef.", en: "Reads the status, expiry, nameservers and auto-renewal of a domain the shop holds." },
    ),
    [TOOL.domainList]: reads(
        { vi: "Xem c\u00e1c t\u00ean mi\u1ec1n", en: "List the domains" },
        { vi: "Li\u1ec7t k\u00ea c\u00e1c t\u00ean mi\u1ec1n m\u1ed9t t\u00e0i kho\u1ea3n nh\u00e0 \u0111\u0103ng k\u00fd \u0111ang gi\u1eef.", en: "Lists the domains one registrar account holds." },
    ),
    [TOOL.domainRegistrationCreate]: acts(
        { vi: "\u0110\u0103ng k\u00fd t\u00ean mi\u1ec1n", en: "Register a domain" },
        { vi: "\u0110\u0103ng k\u00fd m\u1ed9t t\u00ean mi\u1ec1n m\u1edbi trong s\u1ed1 n\u0103m cho tr\u01b0\u1edbc; nh\u00e0 \u0111\u0103ng k\u00fd tr\u1eeb ti\u1ec1n t\u00e0i kho\u1ea3n.", en: "Registers a new domain name for the given years; the registrar charges the account." },
    ),
    [TOOL.domainRenewalCreate]: acts(
        { vi: "Gia h\u1ea1n t\u00ean mi\u1ec1n", en: "Renew a domain" },
        { vi: "Gia h\u1ea1n m\u1ed9t t\u00ean mi\u1ec1n \u0111ang gi\u1eef th\u00eam s\u1ed1 n\u0103m cho tr\u01b0\u1edbc, t\u1ea1i t\u00e0i kho\u1ea3n \u0111ang gi\u1eef n\u00f3.", en: "Renews a domain the shop holds for the given years, at the account that holds it." },
    ),
    [TOOL.domainRenewalGet]: reads(
        { vi: "Xem kết quả gia hạn", en: "Check a renewal" },
        { vi: "Xem một lần gia hạn tên miền đã có hiệu lực chưa, theo ngày hết hạn mới.", en: "Checks whether a domain renewal took effect, by its new expiry." },
    ),
    [TOOL.domainTransferCreate]: acts(
        { vi: "Chuy\u1ec3n t\u00ean mi\u1ec1n v\u1ec1", en: "Transfer a domain in" },
        { vi: "Y\u00eau c\u1ea7u chuy\u1ec3n m\u1ed9t t\u00ean mi\u1ec1n t\u1eeb nh\u00e0 \u0111\u0103ng k\u00fd kh\u00e1c v\u1ec1, b\u1eb1ng m\u00e3 chuy\u1ec3n c\u1ee7a n\u01a1i \u0111\u00f3.", en: "Asks a domain held at another registrar to move here, with that registrar's transfer code." },
    ),
    [TOOL.domainDnsRecordList]: reads(
        { vi: "Xem b\u1ea3n ghi DNS", en: "List DNS records" },
        { vi: "Li\u1ec7t k\u00ea c\u00e1c b\u1ea3n ghi DNS c\u1ee7a m\u1ed9t t\u00ean mi\u1ec1n \u0111ang gi\u1eef.", en: "Lists the DNS records of a domain the shop holds." },
    ),
    [TOOL.domainDnsRecordCreate]: acts(
        { vi: "Th\u00eam b\u1ea3n ghi DNS", en: "Add a DNS record" },
        { vi: "Th\u00eam m\u1ed9t b\u1ea3n ghi DNS cho m\u1ed9t t\u00ean mi\u1ec1n \u0111ang gi\u1eef.", en: "Adds one DNS record to a domain the shop holds." },
    ),
    [TOOL.domainDnsRecordUpdate]: acts(
        { vi: "S\u1eeda b\u1ea3n ghi DNS", en: "Change a DNS record" },
        { vi: "Thay m\u1ed9t b\u1ea3n ghi DNS c\u1ee7a t\u00ean mi\u1ec1n \u0111ang gi\u1eef, theo m\u00e3 b\u1ea3n ghi \u0111\u00e3 xem.", en: "Replaces one DNS record of a domain the shop holds, by the id the list gave." },
    ),
    [TOOL.domainDnsRecordDelete]: acts(
        { vi: "Xo\u00e1 b\u1ea3n ghi DNS", en: "Remove a DNS record" },
        { vi: "Xo\u00e1 m\u1ed9t b\u1ea3n ghi DNS c\u1ee7a t\u00ean mi\u1ec1n \u0111ang gi\u1eef, theo m\u00e3 b\u1ea3n ghi \u0111\u00e3 xem.", en: "Removes one DNS record of a domain the shop holds, by the id the list gave." },
    ),
    [TOOL.domainNameserverUpdate]: acts(
        { vi: "\u0110\u1ed5i nameserver", en: "Change the nameservers" },
        { vi: "Thay c\u00e1c nameserver c\u1ee7a m\u1ed9t t\u00ean mi\u1ec1n \u0111ang gi\u1eef.", en: "Replaces the nameservers of a domain the shop holds." },
    ),
    [TOOL.speechGenerate]: acts(
        { vi: "\u0110\u1ecdc th\u00e0nh gi\u1ecdng n\u00f3i", en: "Turn text into speech" },
        { vi: "\u0110\u1ecdc m\u1ed9t \u0111o\u1ea1n v\u0103n b\u1eb1ng m\u1ed9t gi\u1ecdng c\u1ee7a t\u00e0i kho\u1ea3n gi\u1ecdng n\u00f3i v\u00e0 l\u01b0u th\u00e0nh t\u1ec7p \u00e2m thanh.", en: "Reads a text aloud in a voice of the speech account and keeps the audio file." },
    ),
    [TOOL.speechVoiceList]: reads(
        { vi: "Xem gi\u1ecdng \u0111\u1ecdc", en: "List the voices" },
        { vi: "Li\u1ec7t k\u00ea c\u00e1c gi\u1ecdng \u0111\u1ecdc c\u1ee7a t\u00e0i kho\u1ea3n gi\u1ecdng n\u00f3i.", en: "Lists the voices of the speech account." },
    ),
    [TOOL.dubbingCreate]: acts(
        { vi: "L\u1ed3ng ti\u1ebfng video", en: "Dub a video" },
        { vi: "B\u1eaft \u0111\u1ea7u l\u1ed3ng ti\u1ebfng m\u1ed9t video ho\u1eb7c \u00e2m thanh sang ng\u00f4n ng\u1eef kh\u00e1c; tr\u1ea3 v\u1ec1 m\u00e3 vi\u1ec7c.", en: "Starts dubbing a video or audio into another language; answers the job id." },
    ),
    [TOOL.dubbingGet]: reads(
        { vi: "Xem vi\u1ec7c l\u1ed3ng ti\u1ebfng", en: "Read a dubbing job" },
        { vi: "Xem vi\u1ec7c l\u1ed3ng ti\u1ebfng t\u1edbi \u0111\u00e2u v\u00e0 l\u1ea5y t\u1ec7p khi xong.", en: "Reads how far a dubbing job is and its files once done." },
    ),
    [TOOL.videoGenerate]: acts(
        { vi: "T\u1ea1o video", en: "Generate a video" },
        { vi: "B\u1eaft \u0111\u1ea7u t\u1ea1o m\u1ed9t video t\u1eeb m\u00f4 t\u1ea3, c\u00f3 th\u1ec3 t\u1eeb m\u1ed9t \u1ea3nh \u0111\u1ea7u; tr\u1ea3 v\u1ec1 m\u00e3 vi\u1ec7c.", en: "Starts generating a video from a description, optionally from a first image; answers the job id." },
    ),
    [TOOL.videoGenerationGet]: reads(
        { vi: "Xem video \u0111ang t\u1ea1o", en: "Read a video generation" },
        { vi: "Xem vi\u1ec7c t\u1ea1o video t\u1edbi \u0111\u00e2u v\u00e0 l\u1ea5y t\u1ec7p khi xong.", en: "Reads how far a video generation is and its files once done." },
    ),
    [TOOL.videoCompose]: acts(
        { vi: "D\u1ef1ng video", en: "Compose a video" },
        { vi: "Gh\u00e9p c\u00e1c \u0111o\u1ea1n phim, l\u1eddi \u0111\u1ecdc, logo v\u00e0 ph\u1ee5 \u0111\u1ec1 th\u00e0nh m\u1ed9t video t\u1ea1i d\u1ecbch v\u1ee5 d\u1ef1ng \u0111\u00e3 k\u1ebft n\u1ed1i; tr\u1ea3 v\u1ec1 m\u00e3 l\u1ea7n d\u1ef1ng.", en: "Joins clips, a narration, a logo and captions into one video at the connected compose service; answers the render id." },
    ),
    [TOOL.videoRenderGet]: reads(
        { vi: "Xem video \u0111ang d\u1ef1ng", en: "Read a video render" },
        { vi: "Xem l\u1ea7n d\u1ef1ng video t\u1edbi \u0111\u00e2u v\u00e0 l\u1ea5y \u0111\u1ecba ch\u1ec9 video khi xong.", en: "Reads how far a video render is and the address of the video once done." },
    ),
    [TOOL.calendarSlotFreeList]: reads(
        { vi: "Xem gi\u1edd tr\u1ed1ng tr\u00ean l\u1ecbch", en: "List free calendar slots" },
        { vi: "Li\u1ec7t k\u00ea c\u00e1c khung gi\u1edd c\u00f2n tr\u1ed1ng tr\u00ean l\u1ecbch c\u1ee7a ti\u1ec7m trong m\u1ed9t kho\u1ea3ng th\u1eddi gian.", en: "Lists the free time slots of the shop's calendar inside a window." },
    ),
    [TOOL.calendarEventCreate]: acts(
        { vi: "T\u1ea1o s\u1ef1 ki\u1ec7n tr\u00ean l\u1ecbch", en: "Create a calendar event" },
        { vi: "T\u1ea1o m\u1ed9t s\u1ef1 ki\u1ec7n (ti\u00eau \u0111\u1ec1, gi\u1edd, kh\u00e1ch m\u1eddi) tr\u00ean l\u1ecbch c\u1ee7a ti\u1ec7m.", en: "Makes an event (title, time, guests) on the shop's calendar." },
    ),
    [TOOL.calendarEventUpdate]: acts(
        { vi: "S\u1eeda s\u1ef1 ki\u1ec7n tr\u00ean l\u1ecbch", en: "Update a calendar event" },
        { vi: "\u0110\u1ed5i gi\u1edd, n\u01a1i ho\u1eb7c kh\u00e1ch m\u1eddi c\u1ee7a m\u1ed9t s\u1ef1 ki\u1ec7n tr\u00ean l\u1ecbch.", en: "Changes the time, place or guests of a calendar event." },
    ),
    [TOOL.calendarEventCancel]: acts(
        { vi: "H\u1ee7y s\u1ef1 ki\u1ec7n tr\u00ean l\u1ecbch", en: "Cancel a calendar event" },
        { vi: "H\u1ee7y m\u1ed9t s\u1ef1 ki\u1ec7n \u0111\u00e3 \u0111\u1eb7t tr\u00ean l\u1ecbch.", en: "Cancels an event booked on the calendar." },
    ),
    [TOOL.facebookPostPublish]: acts(
        { vi: "\u0110\u0103ng b\u00e0i Facebook", en: "Publish a Facebook post" },
        { vi: "\u0110\u0103ng m\u1ed9t b\u00e0i (ch\u1eef, \u1ea3nh ho\u1eb7c video) l\u00ean trang Facebook c\u1ee7a ti\u1ec7m.", en: "Publishes a post (text, photo or video) to the shop's Facebook Page." },
    ),
    [TOOL.instagramMediaPublish]: acts(
        { vi: "\u0110\u0103ng l\u00ean Instagram", en: "Publish to Instagram" },
        { vi: "\u0110\u0103ng \u1ea3nh, video, reel, story ho\u1eb7c nhi\u1ec1u \u1ea3nh l\u00ean Instagram c\u1ee7a ti\u1ec7m.", en: "Publishes a photo, video, reel, story or carousel to the shop's Instagram." },
    ),
    [TOOL.instagramMediaStatusGet]: reads(
        { vi: "Xem b\u00e0i Instagram \u0111ang x\u1eed l\u00fd", en: "Read an Instagram container" },
        { vi: "Xem b\u00e0i \u0111\u0103ng Instagram \u0111\u00e3 x\u1eed l\u00fd xong ch\u01b0a.", en: "Reads whether an Instagram post has finished processing." },
    ),
    [TOOL.youtubeVideoPublish]: acts(
        { vi: "\u0110\u0103ng video YouTube", en: "Publish a YouTube video" },
        { vi: "\u0110\u0103ng m\u1ed9t video l\u00ean k\u00eanh YouTube c\u1ee7a ti\u1ec7m.", en: "Uploads a video to the shop's YouTube channel." },
    ),
    [TOOL.youtubeVideoStatusGet]: reads(
        { vi: "Xem video YouTube", en: "Read a YouTube video" },
        { vi: "Xem video YouTube \u0111\u00e3 t\u1ea3i l\u00ean v\u00e0 x\u1eed l\u00fd xong ch\u01b0a.", en: "Reads whether an uploaded YouTube video has finished processing." },
    ),
    [TOOL.tiktokVideoPublish]: acts(
        { vi: "\u0110\u0103ng video l\u00ean TikTok", en: "Publish a video to TikTok" },
        { vi: "\u0110\u0103ng m\u1ed9t video l\u00ean t\u00e0i kho\u1ea3n TikTok c\u1ee7a ti\u1ec7m.", en: "Posts a video to the shop's TikTok account." },
    ),
    [TOOL.tiktokVideoStatusGet]: reads(
        { vi: "Xem tr\u1ea1ng th\u00e1i video TikTok", en: "Check a TikTok post" },
        { vi: "Xem video TikTok \u0111ang ch\u1edd, \u0111\u00e3 \u0111\u0103ng hay b\u1ecb t\u1eeb ch\u1ed1i.", en: "Reads whether a TikTok post is pending, published or refused." },
    ),
    [TOOL.tiktokCreatorInfoGet]: reads(
        { vi: "Xem gi\u1edbi h\u1ea1n \u0111\u0103ng c\u1ee7a t\u00e0i kho\u1ea3n TikTok", en: "Read the TikTok account's posting limits" },
        { vi: "Xem t\u00e0i kho\u1ea3n TikTok \u0111\u01b0\u1ee3c \u0111\u0103ng v\u1edbi quy\u1ec1n ri\u00eang t\u01b0, gi\u1edbi h\u1ea1n t\u01b0\u01a1ng t\u00e1c v\u00e0 \u0111\u1ed9 d\u00e0i video n\u00e0o.", en: "Reads the privacy options, interaction limits and longest video the TikTok account may post with." },
    ),
}

/** The owner-facing words of a tool, or null for a tool this file does not name. */
export const toolLabelOf = (tool: string): ToolLabel | null => (Object.hasOwn(TOOL_LABELS, tool) ? TOOL_LABELS[tool] ?? null : null)
