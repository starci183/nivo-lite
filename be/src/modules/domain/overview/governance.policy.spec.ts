import { builder } from "@starci/jest-preset"
import {
    GovernanceDecidedPath,
    GovernanceDeciderKind,
    GovernanceDecisionOutcome,
    GovernanceWorkReason,
    GovernanceWorkStatus,
    presentGovernance,
} from "./governance.policy"
import type { RawGovernance } from "./governance.policy"

const workOf = builder<RawGovernance["work"][number]>({
    id: "work-1",
    leadId: "lead-1",
    department: "sales",
    status: "done",
    reason: "routine",
    decidedPath: "auto",
    createdAt: "2026-10-13T01:00:00.000Z",
    updatedAt: "2026-10-13T02:00:00.000Z",
    completedAt: "2026-10-13T02:00:00.000Z",
    summary: "Confirm the order",
    contact: "Lan",
    customer: "Tea shop",
})

const decisionOf = builder<RawGovernance["decisions7"][number]>({
    workItemId: "work-1",
    leadId: "lead-1",
    deciderKind: "policy",
    outcome: "auto_done",
    createdAt: "2026-10-13T02:00:00.000Z",
})

const governanceOf = builder<RawGovernance>({
    authority: { goalRevenueVnd: 5000000, goalNewCustomers: 10, goalFirstReplyMinutes: 5 },
    leads: [],
    orders: [],
    invoices: [],
    transactions: [],
    work: [],
    pendingWithoutWork: 3,
    decisions7: [],
    recent: [],
})

describe("presentGovernance", () => {
    it.each([
        {
            status: "queued",
            reason: "routine",
            path: "auto",
            expectedStatus: GovernanceWorkStatus.Queued,
            expectedReason: GovernanceWorkReason.Routine,
            expectedPath: GovernanceDecidedPath.Auto,
        },
        {
            status: "done",
            reason: "missing_data",
            path: "human",
            expectedStatus: GovernanceWorkStatus.Done,
            expectedReason: GovernanceWorkReason.MissingData,
            expectedPath: GovernanceDecidedPath.Human,
        },
        {
            status: "waiting_decision",
            reason: "over_authority",
            path: null,
            expectedStatus: GovernanceWorkStatus.WaitingDecision,
            expectedReason: GovernanceWorkReason.OverAuthority,
            expectedPath: null,
        },
        {
            status: "rejected",
            reason: "unclear_outcome",
            path: "auto",
            expectedStatus: GovernanceWorkStatus.Rejected,
            expectedReason: GovernanceWorkReason.UnclearOutcome,
            expectedPath: GovernanceDecidedPath.Auto,
        },
        {
            status: "failed",
            reason: "not_allowed",
            path: "human",
            expectedStatus: GovernanceWorkStatus.Failed,
            expectedReason: GovernanceWorkReason.NotAllowed,
            expectedPath: GovernanceDecidedPath.Human,
        },
    ])(
        "presents stored work words: $status, $reason, $path",
        ({ status, reason, path, expectedStatus, expectedReason, expectedPath }) => {
            const work = workOf({ status, reason, decidedPath: path })
            const raw = governanceOf({ work: [work] })

            expect(presentGovernance(raw)).toEqual({
                ...raw,
                work: [{ ...work, status: expectedStatus, reason: expectedReason, decidedPath: expectedPath }],
            })
            expect(raw.work).toEqual([workOf({ status, reason, decidedPath: path })])
        },
    )

    it("defaults unrecognized work words to queued and absent classifications", () => {
        const work = workOf({ status: "legacy-status", reason: "legacy-reason", decidedPath: "legacy-path" })
        const raw = governanceOf({ work: [work] })

        expect(presentGovernance(raw)).toEqual({
            ...raw,
            work: [{ ...work, status: GovernanceWorkStatus.Queued, reason: null, decidedPath: null }],
        })
    })

    it("retains null work classifications and optional descriptive fields", () => {
        const work = workOf({
            reason: null,
            decidedPath: null,
            leadId: null,
            completedAt: null,
            summary: null,
            contact: null,
            customer: null,
        })
        const raw = governanceOf({ authority: null, work: [work] })

        expect(presentGovernance(raw)).toEqual({
            ...raw,
            work: [{ ...work, status: GovernanceWorkStatus.Done, reason: null, decidedPath: null }],
        })
    })

    it.each([
        {
            kind: "policy",
            outcome: "auto_done",
            expectedKind: GovernanceDeciderKind.Policy,
            expectedOutcome: GovernanceDecisionOutcome.AutoDone,
        },
        {
            kind: "owner",
            outcome: "approved",
            expectedKind: GovernanceDeciderKind.Owner,
            expectedOutcome: GovernanceDecisionOutcome.Approved,
        },
        {
            kind: "staff",
            outcome: "edited",
            expectedKind: GovernanceDeciderKind.Staff,
            expectedOutcome: GovernanceDecisionOutcome.Edited,
        },
        {
            kind: "owner",
            outcome: "rejected",
            expectedKind: GovernanceDeciderKind.Owner,
            expectedOutcome: GovernanceDecisionOutcome.Rejected,
        },
        {
            kind: "legacy-decider",
            outcome: "legacy-outcome",
            expectedKind: GovernanceDeciderKind.Policy,
            expectedOutcome: GovernanceDecisionOutcome.Approved,
        },
    ])("presents stored decision words: $kind, $outcome", ({ kind, outcome, expectedKind, expectedOutcome }) => {
        const decision = decisionOf({ deciderKind: kind, outcome })
        const raw = governanceOf({ decisions7: [decision] })

        expect(presentGovernance(raw)).toEqual({
            ...raw,
            decisions7: [{ ...decision, deciderKind: expectedKind, outcome: expectedOutcome }],
        })
        expect(raw.decisions7).toEqual([decisionOf({ deciderKind: kind, outcome })])
    })

    it("preserves an empty governance block", () => {
        expect(presentGovernance(governanceOf())).toEqual(governanceOf())
    })
})
