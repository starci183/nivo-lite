import type { BoundConnection } from "@modules/domain/agent-connections"
import type { WorkItem } from "@modules/domain/work-items"
import { connectionOf, evidenceCodeOf, evidenceOf, levelOf, logLineOf, stepsOf } from "./agent-work-log.policy"

const itemOf = (overrides: Partial<WorkItem> = {}): WorkItem => ({
    id: "w-1",
    workspace_id: "ws-1",
    department: "accounting",
    action: "record_payment",
    subject_type: "transaction",
    subject_id: "t-1",
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: "w-1",
    depth: 0,
    status: "done",
    decided_path: "auto",
    reason: "routine",
    reasons: ["routine"],
    missing_fields: [],
    proposal: {
        summary: "Match 250000 to order 1043",
        fields: { reference: "DH1043" },
        evidence: [
            { key: "content", value: "DH1043 NGUYEN VAN AN", kind: "read", via: "feed" },
            { key: "unread", value: null, kind: "read", via: "feed" },
        ],
    },
    result: { summary: "Recorded BT-0412", href: "/ledger/BT-0412" },
    error: null,
    evidence_state: "captured",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-11-09T07:32:04.000Z",
    updated_at: "2026-11-09T07:32:06.000Z",
    completed_at: "2026-11-09T07:32:06.000Z",
    installation_id: "inst-1",
    ...overrides,
})

const grantOf = (overrides: Partial<BoundConnection> = {}): BoundConnection => ({
    id: "c-1",
    provider: "sepay",
    name: "MB 9999",
    botUsername: null,
    accountMasked: null,
    status: "connected",
    access: "auto",
    purpose: "bank_feed",
    ...overrides,
})

describe("agent work log policy", () => {
    it("reads the level from how the item was decided", () => {
        expect(levelOf(itemOf({ decided_path: "auto" }))).toBe("auto")
        expect(levelOf(itemOf({ decided_path: "human" }))).toBe("ask")
        expect(levelOf(itemOf({ decided_path: null }))).toBeNull()
    })

    it("names the connection only when exactly one grant fits what the work is about", () => {
        expect(connectionOf(itemOf(), [grantOf()])).toEqual({ id: "c-1", name: "MB 9999", provider: "sepay" })
        expect(connectionOf(itemOf(), [grantOf(), grantOf({ id: "c-2" })])).toBeNull()
        expect(connectionOf(itemOf(), [grantOf({ purpose: "tool" })])).toBeNull()
        expect(connectionOf(itemOf({ subject_type: "order" }), [grantOf()])).toBeNull()
    })

    it("keeps the evidence that was read and the payment reference", () => {
        expect(evidenceOf(itemOf())).toEqual([{ key: "content", value: "DH1043 NGUYEN VAN AN" }])
        expect(evidenceCodeOf(itemOf())).toBe("DH1043")
        expect(evidenceCodeOf(itemOf({ proposal: { summary: "x", fields: {} } }))).toBeNull()
    })

    it("tells the steps of a finished, a waiting and a failed item", () => {
        expect(stepsOf(itemOf()).map((step) => step.key)).toEqual(["raised", "closed"])
        const waiting = stepsOf(itemOf({ status: "waiting_decision", decided_path: "human", reason: "over_authority" }))
        expect(waiting.map((step) => `${step.key}:${step.state}`)).toEqual([
            "raised:done",
            "gate:current",
            "decided:current",
            "closed:current",
        ])
        expect(stepsOf(itemOf({ status: "failed" })).at(-1)?.state).toBe("failed")
    })

    it("builds a line with the result as title and the proposal as detail", () => {
        expect(logLineOf(itemOf(), [grantOf()])).toMatchObject({
            id: "w-1",
            title: "Recorded BT-0412",
            detail: "Match 250000 to order 1043",
            status: "done",
            level: "auto",
            evidenceCode: "DH1043",
            resultHref: "/ledger/BT-0412",
        })
        expect(logLineOf(itemOf({ result: null, status: "queued" }), []).detail).toBe("")
    })
})
