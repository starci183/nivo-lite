import { z } from "zod"
import type { WorkItemView } from "@/lib/flow-types"
import { isActionKey, isModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"
import type {
    AccountingLedgerEntryType,
    AccountingProposalType,
    AccountingQuestionWorkType,
    AccountingWorkbenchType,
} from "@/modules/api"
import type {
    AccountingCredit,
    AccountingInvoice,
    AccountingLedgerEntry,
    AccountingOrder,
    AccountingQuestion,
    AccountingWorkbenchData,
} from "@/modules/types"

const subjectTypeSchema = z.enum([
    "lead",
    "order",
    "invoice",
    "transaction",
    "conversation",
    "inbound",
    "purchase_order",
    "stock",
])
const workStatusSchema = z.enum(["queued", "done", "waiting_decision", "rejected", "failed"])
const decisionPathSchema = z.enum(["auto", "human"]).nullable()
const reasonSchema = z.enum(["routine", "missing_data", "over_authority", "unclear_outcome", "not_allowed"]).nullable()
const evidenceStateSchema = z.enum(["pending", "captured", "reviewed", "verified", "customer_confirmed"])
const ledgerTargetSchema = z.enum(["invoice", "transaction"])
const ledgerKindSchema = z.enum(["income", "receivable"])
const ledgerStatusSchema = z.enum(["issued", "paid", "void", "settled", "matched", "unmatched", "needs_review"])
const lineageKindSchema = z.enum(["order", "invoice", "payment", "decision", "adjustment"])
const matchSchema = z.enum(["matched", "unclear", "unmatched"])
const sourceKindSchema = z.enum(["vietcombank", "inbox", "manual", "other"])
const invoiceStatusSchema = z.enum(["draft", "issued", "paid", "void"])
const questionGroupSchema = z.enum(["unclear_payment", "over_limit", "missing_data", "other"])

const departmentOf = (value: string): WorkItemView["department"] => {
    if (!isModuleKey(value)) throw new Error("Unknown accounting question department")
    return value
}

const actionOf = (value: string): WorkItemView["action"] => {
    if (!isActionKey(value)) throw new Error("Unknown accounting question action")
    return value
}

/** Presents the generated proposal fields in the existing decision form's keyed shape. */
const proposalOf = (proposal: AccountingProposalType): WorkItemView["proposal"] => ({
    summary: proposal.summary,
    ...(proposal.draft == null ? {} : { draft: proposal.draft }),
    amount_vnd: proposal.amountVnd ?? null,
    fields: Object.fromEntries(proposal.fields.map((field) => [field.name, field.number ?? field.text ?? null])),
    ...(proposal.confidence == null ? {} : { confidence: proposal.confidence }),
    ...(proposal.outcome === "clear" || proposal.outcome === "unclear" ? { outcome: proposal.outcome } : {}),
    candidates: proposal.candidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.label,
        amount_vnd: candidate.amountVnd,
    })),
})

/** Renames the generated question fields for the existing view model, with no financial calculations. */
const questionItemOf = (item: AccountingQuestionWorkType): WorkItemView => ({
    id: item.id,
    workspace_id: item.workspaceId,
    department: departmentOf(item.department),
    action: actionOf(item.action),
    subject_type: subjectTypeSchema.parse(item.subjectType),
    subject_id: item.subjectId ?? null,
    lead_id: item.leadId ?? null,
    inbound_event_id: item.inboundEventId ?? null,
    parent_id: item.parentId ?? null,
    chain_id: item.chainId ?? null,
    depth: item.depth,
    status: workStatusSchema.parse(item.status),
    decided_path: decisionPathSchema.parse(item.decidedPath ?? null),
    reason: reasonSchema.parse(item.reason ?? null),
    reasons: [...item.reasons],
    missing_fields: [...item.missingFields],
    proposal: proposalOf(item.proposal),
    result:
        item.result == null
            ? null
            : { summary: item.result.summary, ...(item.result.href == null ? {} : { href: item.result.href }) },
    error: item.error ?? null,
    evidence_state: evidenceStateSchema.parse(item.evidenceState),
    assigned_staff_id: item.assignedStaffId ?? null,
    assignedStaffName: item.assignedStaffName ?? null,
    execution_id: item.executionId ?? null,
    origin: item.origin === "simulated" ? "simulated" : "live",
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    completed_at: item.completedAt ?? null,
    installation_id: item.installationId ?? null,
    lead:
        item.lead == null
            ? null
            : {
                  id: item.lead.id,
                  contact_name: item.lead.contactName,
                  company: item.lead.company,
                  channel: item.lead.channel,
              },
    hasApprovalCard: false,
    href: item.leadId
        ? `/leads/${item.leadId}`
        : agentHref(
              "accounting",
              null,
              "workbench",
              new URLSearchParams({ tab: "questions", focus: item.id }).toString(),
          ),
})

/** Normalizes optional GraphQL fields and the backend-owned status strings for the ledger presentation. */
const ledgerEntryOf = (entry: AccountingLedgerEntryType): AccountingLedgerEntry => ({
    ...entry,
    targetType: ledgerTargetSchema.parse(entry.targetType),
    kind: ledgerKindSchema.parse(entry.kind),
    status: ledgerStatusSchema.parse(entry.status),
    linked: entry.linked ?? null,
    origin: entry.origin === "simulated" ? "simulated" : "live",
    lineage: entry.lineage.map((step) => ({
        ...step,
        kind: lineageKindSchema.parse(step.kind),
        at: step.at ?? null,
        detail: step.detail ?? null,
        status: step.status ?? null,
        amount: step.amount ?? null,
    })),
})

/** Adapts the generated accounting read model to the pure workbench presentation. */
export const accountingWorkbenchOf = (data: AccountingWorkbenchType): AccountingWorkbenchData => ({
    ...data,
    periods: {
        this: { ...data.periods.this, key: "this" },
        last: { ...data.periods.last, key: "last" },
    },
    credits: data.credits.map((credit): AccountingCredit => ({
        ...credit,
        origin: credit.origin === "simulated" ? "simulated" : "live",
        match: matchSchema.parse(credit.match),
        sourceKind: sourceKindSchema.parse(credit.sourceKind),
        payer: credit.payer ?? null,
        reference: credit.reference ?? null,
        invoiceNo: credit.invoiceNo ?? null,
    })),
    invoices: data.invoices.map((invoice): AccountingInvoice => ({
        ...invoice,
        origin: invoice.origin === "simulated" ? "simulated" : "live",
        status: invoiceStatusSchema.parse(invoice.status),
        customer: invoice.customer ?? null,
        issuedAt: invoice.issuedAt ?? null,
        paidAt: invoice.paidAt ?? null,
        dueAt: invoice.dueAt ?? null,
        orderNo: invoice.orderNo ?? null,
    })),
    ordersWithoutInvoice: data.ordersWithoutInvoice.map((order): AccountingOrder => ({
        ...order,
        origin: order.origin === "simulated" ? "simulated" : "live",
        amount: order.amount ?? null,
        customer: order.customer ?? null,
    })),
    questions: data.questions.map((question): AccountingQuestion => ({
        group: questionGroupSchema.parse(question.group),
        item: questionItemOf(question.item),
    })),
    staff: data.staff.map((member) => ({
        id: member.id,
        workspace_id: member.workspaceId,
        name: member.name,
        role: member.role,
        email: member.email ?? null,
        active: member.active,
        created_at: member.createdAt,
    })),
    ledger: data.ledger.map(ledgerEntryOf),
})
