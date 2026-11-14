import type { TemplateNode } from "@nivo-lite/agent-sdk/template"
import { webbooksDueNode } from "./due.node"
import { webbooksInvoiceDraftNode } from "./invoice-draft.node"
import { webbooksInvoiceIssueNode } from "./invoice-issue.node"
import { webbooksInvoiceMailNode } from "./invoice-mail.node"
import { webbooksInvoiceTeamNode } from "./invoice-team.node"
import { webbooksIssueRecordNode } from "./issue-record.node"
import { webbooksNoticeDraftNode } from "./notice-draft.node"
import { webbooksNoticeRecordNode } from "./notice-record.node"
import { webbooksNoticeTeamNode } from "./notice-team.node"
import { webbooksPaymentCreditNode } from "./payment-credit.node"
import { webbooksPaymentOpenNode } from "./payment-open.node"
import { webbooksPaymentSettleNode } from "./payment-settle.node"
import { webbooksPurchasePaidTeamNode } from "./purchase-paid-team.node"
import { webbooksPurchasePaidNode } from "./purchase-paid.node"
import { webbooksRenewalPaidTeamNode } from "./renewal-paid-team.node"
import { webbooksRenewalPaidNode } from "./renewal-paid.node"
import { webbooksRoundReportNode } from "./round-report.node"
import { webbooksSupplierCheckNode } from "./supplier-check.node"
import { webbooksSupplierNoteNode } from "./supplier-note.node"
import { webbooksSupplierReportNode } from "./supplier-report.node"
import { webbooksTeamAnswerNode } from "./team-answer.node"

/**
 * The steps of the Accounting agent, graph by graph: read a bank credit and the requests awaiting money, settle the credit against a renewal or a purchase,
 * record it paid and tell the team; draft, issue, record and mail the invoice and tell the team; find, remind, record and report
 * receivables; check, note and report supplier invoices; answer the team (`webbooks.team-answer`, converted by the team-answer
 * factory's worker). `webbooks.payment-match` and `webbooks.payment-reconcile` are deleted (used by old template versions only,
 * ADDENDUM 2).
 */
export const webbooksNodes: ReadonlyArray<TemplateNode> = [
    webbooksPaymentCreditNode,
    webbooksPaymentOpenNode,
    webbooksPaymentSettleNode,
    webbooksRenewalPaidNode,
    webbooksRenewalPaidTeamNode,
    webbooksPurchasePaidNode,
    webbooksPurchasePaidTeamNode,
    webbooksInvoiceDraftNode,
    webbooksInvoiceIssueNode,
    webbooksIssueRecordNode,
    webbooksInvoiceMailNode,
    webbooksInvoiceTeamNode,
    webbooksDueNode,
    webbooksNoticeTeamNode,
    webbooksNoticeDraftNode,
    webbooksNoticeRecordNode,
    webbooksRoundReportNode,
    webbooksSupplierCheckNode,
    webbooksSupplierNoteNode,
    webbooksSupplierReportNode,
    webbooksTeamAnswerNode,
]
