import { mock } from "@starci/jest-preset"
import type { ModuleApprovalRequest } from "@modules/domain/module-ops"
import type { Proposal, WorkContext, WorkItem } from "./decisions.contracts"
import { performContextOf, performedOf, proposalOf, subjectTypeOf } from "./module-gate.policy"

const request: ModuleApprovalRequest = {
    workspaceId: "ws-1",
    actor: "NIVO",
    action: "send_offer",
    subjectType: "candidate",
    subjectId: "candidate-1",
    dedupeKey: "send_offer:candidate-1",
    summary: "Offer for Chi",
    fields: {},
}

const ctx: WorkContext = { workspaceId: "ws-1", actor: "NIVO", locale: "vi" }

describe("module gate policy", () => {
    it.each([
        "lead",
        "order",
        "invoice",
        "transaction",
        "conversation",
        "inbound",
        "purchase_order",
        "stock",
        "video_project",
    ])("keeps the known subject kind %s", (kind) => {
        expect(subjectTypeOf(kind)).toBe(kind)
    })

    it.each(["candidate", "LEAD", "", " lead "])("records the unrecognized subject kind %p as inbound", (kind) => {
        expect(subjectTypeOf(kind)).toBe("inbound")
    })

    it("omits draft and amount when the request does not supply them", () => {
        expect(proposalOf(request)).toEqual({ summary: "Offer for Chi", fields: {} })
    })

    it("keeps the draft and amount and translates boolean facts to text", () => {
        expect(
            proposalOf({
                ...request,
                draft: "Dear Chi",
                amountVnd: 1_500_000,
                fields: { accepted: true, urgent: false, name: "Chi", count: 2, missing: null },
            }),
        ).toEqual({
            summary: "Offer for Chi",
            draft: "Dear Chi",
            amount_vnd: 1_500_000,
            fields: { accepted: "true", urgent: "false", name: "Chi", count: 2, missing: null },
        })
    })

    it("preserves an empty draft and zero amount rather than omitting them", () => {
        expect(proposalOf({ ...request, draft: "", amountVnd: 0 })).toEqual({
            summary: "Offer for Chi",
            draft: "",
            amount_vnd: 0,
            fields: {},
        })
    })

    it.each([
        { draft: "Edited offer", expectedDraft: "Edited offer" },
        { draft: "", expectedDraft: "" },
        { draft: undefined, expectedDraft: null },
    ])("uses the deciding person's draft $draft and facts", ({ draft, expectedDraft }) => {
        const item = mock<WorkItem>({ id: "item-1" })
        const proposal: Proposal = { summary: "Offer", draft, fields: { candidate_id: "candidate-1" } }

        expect(performContextOf(ctx, item, proposal, { name: "Chi", kind: "owner" })).toEqual({
            workspaceId: "ws-1",
            workItemId: "item-1",
            actor: "Chi",
            draft: expectedDraft,
            fields: { candidate_id: "candidate-1" },
        })
    })

    it("records a performer's href and detail alongside the item's lead", () => {
        const item = mock<WorkItem>({ lead_id: "lead-1" })

        expect(
            performedOf(item, {
                summary: "Offer sent",
                evidence: "captured",
                href: "/offers/offer-1",
                detail: "Signed offer",
            }),
        ).toEqual({
            summary: "Offer sent",
            evidence: "captured",
            href: "/offers/offer-1",
            lead_id: "lead-1",
            detail: "Signed offer",
        })
    })

    it("omits an absent href and records null for absent detail and lead", () => {
        const item = mock<WorkItem>({ lead_id: null })

        expect(performedOf(item, { summary: "Offer queued", evidence: "pending" })).toEqual({
            summary: "Offer queued",
            evidence: "pending",
            lead_id: null,
            detail: null,
        })
    })

    it("preserves empty href and detail supplied by the performer", () => {
        const item = mock<WorkItem>({ lead_id: null })

        expect(performedOf(item, { summary: "Offer sent", evidence: "captured", href: "", detail: "" })).toEqual({
            summary: "Offer sent",
            evidence: "captured",
            href: "",
            lead_id: null,
            detail: "",
        })
    })
})
