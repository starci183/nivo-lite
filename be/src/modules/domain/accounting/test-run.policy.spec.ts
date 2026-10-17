import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { AccountingWaitingWorkRow } from "@modules/domain/decisions"
import { isTestRunName, isTestRunWorkItem } from "./test-run.policy"

const SUBJECT = Symbol("test-run.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isTestRunName, isTestRunWorkItem } }],
    }).compile()
    return moduleRef.get<typeof import("./test-run.policy")>(SUBJECT)
}

const itemOf = builder<AccountingWaitingWorkRow>({
    id: "work-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "issue_invoice",
    subject_type: "invoice",
    subject_id: "invoice-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "missing_data",
    reasons: ["missing_data"],
    missing_fields: [],
    proposal: { summary: "Issue payment record", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    assigned_staff_name: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
    lead: null,
})

describe("test-run policy", () => {
    it("only recognizes the case-sensitive legacy markers in string labels", async () => {
        const subject = await buildSubject()

        expect(subject.isTestRunName()).toBe(false)
        expect(subject.isTestRunName(undefined, null, "", "Customer", "uat-dbg")).toBe(false)
        expect(subject.isTestRunName(null, "Customer UAT-42", "Customer")).toBe(true)
        expect(subject.isTestRunName("Customer", "DBG-42 transfer")).toBe(true)
    })

    it("keeps live work with no customer and null, numeric or absent proposal fields", async () => {
        const subject = await buildSubject()

        expect(subject.isTestRunWorkItem(itemOf())).toBe(false)
        expect(
            subject.isTestRunWorkItem(
                itemOf({ proposal: { summary: "Issue invoice", fields: { contact_name: null, customer: 42 } } }),
            ),
        ).toBe(false)
    })

    it.each([
        itemOf({ lead: { id: "lead-1", contact_name: "UAT buyer", company: "Bakery", channel: "manual" } }),
        itemOf({ lead: { id: "lead-1", contact_name: "Mai", company: "DBG Bakery", channel: "manual" } }),
        itemOf({ proposal: { summary: "UAT payment", fields: {} } }),
        itemOf({ proposal: { summary: "Issue invoice", fields: { contact_name: "DBG buyer" } } }),
        itemOf({ proposal: { summary: "Issue invoice", fields: { customer: "UAT customer" } } }),
    ])("excludes a test marker wherever the work item carries a customer label", async (item) => {
        const subject = await buildSubject()

        expect(subject.isTestRunWorkItem(item)).toBe(true)
    })
})
