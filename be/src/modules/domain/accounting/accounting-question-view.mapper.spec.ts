import { builder } from "@starci/jest-preset"
import type { AccountingWaitingWorkRow } from "@modules/domain/decisions"
import { toAccountingQuestionWorkView } from "./accounting-question-view.mapper"

const questionOf = builder<AccountingWaitingWorkRow>({
    id: "work-1",
    workspace_id: "workspace-1",
    department: "accounting",
    action: "accounting.reconcile",
    subject_type: "transaction",
    subject_id: "transaction-1",
    lead_id: "lead-1",
    inbound_event_id: "inbound-1",
    parent_id: "parent-1",
    chain_id: "chain-1",
    depth: 2,
    status: "waiting_decision",
    decided_path: "human",
    reason: "missing_data",
    reasons: ["missing_data", "unclear_outcome"],
    missing_fields: ["invoice_id"],
    proposal: {
        summary: "Choose the matching invoice",
        draft: "Payment received",
        amount_vnd: 120000,
        confidence: 0.7,
        outcome: "unclear",
        fields: { payer: "Mai", amount: 120000, invoice_id: null },
        candidates: [{ id: "invoice-1", label: "INV-1", amount_vnd: 120000 }],
    },
    result: { summary: "Transfer inspected", href: "/transactions/transaction-1" },
    error: "Invoice selection required",
    evidence_state: "captured",
    assigned_staff_id: "staff-1",
    assigned_staff_name: "Lan",
    execution_id: "execution-1",
    origin: "live",
    created_at: "2026-10-12T09:00:00Z",
    updated_at: "2026-10-12T10:00:00Z",
    completed_at: "2026-10-12T11:00:00Z",
    installation_id: "installation-1",
    lead: { id: "lead-1", contact_name: "Mai", company: "Mai Bakery", channel: "email" },
})

describe("toAccountingQuestionWorkView", () => {
    it("preserves the work lineage, candidate evidence and types of named fields", () => {
        expect(toAccountingQuestionWorkView(questionOf())).toEqual({
            id: "work-1",
            workspaceId: "workspace-1",
            department: "accounting",
            action: "accounting.reconcile",
            subjectType: "transaction",
            subjectId: "transaction-1",
            leadId: "lead-1",
            inboundEventId: "inbound-1",
            parentId: "parent-1",
            chainId: "chain-1",
            depth: 2,
            status: "waiting_decision",
            decidedPath: "human",
            reason: "missing_data",
            reasons: ["missing_data", "unclear_outcome"],
            missingFields: ["invoice_id"],
            proposal: {
                summary: "Choose the matching invoice",
                draft: "Payment received",
                amountVnd: 120000,
                confidence: 0.7,
                outcome: "unclear",
                fields: [
                    { name: "payer", text: "Mai", number: null },
                    { name: "amount", text: null, number: 120000 },
                    { name: "invoice_id", text: null, number: null },
                ],
                candidates: [{ id: "invoice-1", label: "INV-1", amountVnd: 120000 }],
            },
            result: { summary: "Transfer inspected", href: "/transactions/transaction-1" },
            error: "Invoice selection required",
            evidenceState: "captured",
            assignedStaffId: "staff-1",
            assignedStaffName: "Lan",
            executionId: "execution-1",
            origin: "live",
            createdAt: "2026-10-12T09:00:00Z",
            updatedAt: "2026-10-12T10:00:00Z",
            completedAt: "2026-10-12T11:00:00Z",
            installationId: "installation-1",
            lead: { id: "lead-1", contactName: "Mai", company: "Mai Bakery", channel: "email" },
        })
    })

    it("exposes omitted proposal values as null and absent collections as empty", () => {
        const view = toAccountingQuestionWorkView(
            questionOf({ proposal: { summary: "No candidate found", fields: {} }, result: null, lead: null }),
        )

        expect(view.proposal).toEqual({
            summary: "No candidate found",
            draft: null,
            amountVnd: null,
            confidence: null,
            outcome: null,
            fields: [],
            candidates: [],
        })
        expect(view.result).toBeNull()
        expect(view.lead).toBeNull()
    })

    it("retains zero and empty text while defaulting an omitted result link", () => {
        const view = toAccountingQuestionWorkView(
            questionOf({
                proposal: { summary: "No charge", draft: "", amount_vnd: 0, confidence: 0, fields: { amount: 0 } },
                result: { summary: "Inspected" },
            }),
        )

        expect(view.proposal).toEqual({
            summary: "No charge",
            draft: "",
            amountVnd: 0,
            confidence: 0,
            outcome: null,
            fields: [{ name: "amount", text: null, number: 0 }],
            candidates: [],
        })
        expect(view.result).toEqual({ summary: "Inspected", href: null })
    })
})
