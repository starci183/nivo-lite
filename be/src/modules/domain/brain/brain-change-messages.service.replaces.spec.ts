import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { BrainFactsErrorCode } from "@modules/domain/brain-facts"
import { brainChangeCardViewOf, brainChangeKeyOf } from "@modules/domain/team-chat"
import type { ReasonedChangeRequest } from "@modules/domain/brain-facts"
import { MANAGER, OWNER, buildChangeWorld, requestOf } from "@tests/fixtures/builders/brain.builder"
import { ANH_VUA_NHAN_TU_MAI_PHI_2_VI, GIAO_HANG_HOA_TOC_VI, NOI_THANH_VI, PHI_GIAO_HANG_VI, PHI_SHIP_VI, PHI_VAN_CHUYEN_VI, PHI_VI, QUY_DINH_BAN_HANG_DOCX_VI, QUY_DINH_VI, TRONG_THANH_PHO_VI, TU_MAI_PHI_SHIP_NOI_THANH_2_VI, T_35_000_D_MOT_DON_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { DELIVERY_FEE_VALUE_VI, DELIVERY_SUBJECT_LABEL_VI } from "@tests/fixtures/i18n/brain-spec.messages"

const SALES = "inst-sales"
/** The live case: the fee in force came from a document, kept for EVERY instance (scope null). */
const IN_FORCE = facts.factOf({
    id: "641d02da",
    subjectKey: "giao-hang-noi-thanh",
    attribute: "phi-giao-hang",
    subjectLabel: DELIVERY_SUBJECT_LABEL_VI,
    attributeLabel: PHI_GIAO_HANG_VI,
    value: DELIVERY_FEE_VALUE_VI,
    status: "active",
    version: 1,
    installationId: null,
    evidence: [{ kind: "document", ref: "doc-rules", label: QUY_DINH_VI, title: QUY_DINH_BAN_HANG_DOCX_VI }],
})
const LIVE_REASON = ANH_VUA_NHAN_TU_MAI_PHI_2_VI
const liveRequest = (changes: Partial<ReasonedChangeRequest> = {}): ReasonedChangeRequest =>
    requestOf({
        subjectLabel: DELIVERY_SUBJECT_LABEL_VI,
        attributeLabel: PHI_GIAO_HANG_VI,
        value: T_35_000_D_MOT_DON_VI,
        quote: TU_MAI_PHI_SHIP_NOI_THANH_2_VI,
        reason: LIVE_REASON,
        installationId: SALES,
        ...changes,
    })

describe("FX5 D-P11-8a: the card finds the value in force it replaces (id, exact key across scopes, near meaning)", () => {
    it("the live case: an agent of one instance changes a workspace-wide fee: kind change, Current 30,000 dong version 1 with its source", async () => {
        const world = await buildChangeWorld()
        world.byId.set(IN_FORCE.id, IN_FORCE)

        const filed = await world.requests.propose(facts.WS, liveRequest())

        // Filed as the next version of THAT fact: its key and its scope (every instance), never a second value beside it.
        expect(world.store.propose.mock.calls[0]?.[1]).toMatchObject({
            subjectLabel: DELIVERY_SUBJECT_LABEL_VI,
            attributeLabel: PHI_GIAO_HANG_VI,
            installationId: null,
        })
        expect(filed.fact.conflictWith).toBe(IN_FORCE.id)
        expect(world.payloadOf(filed.fact.id)).toMatchObject({
            kind: "change",
            oldValue: DELIVERY_FEE_VALUE_VI,
            current: { value: DELIVERY_FEE_VALUE_VI, version: 1, source: QUY_DINH_BAN_HANG_DOCX_VI, match: "same" },
            newValue: T_35_000_D_MOT_DON_VI,
        })
        expect(world.vectors.nearestInForce).not.toHaveBeenCalled()
    })

    it("the fact the agent names by id wins over the labels it chose: filed under that fact's key and scope", async () => {
        const world = await buildChangeWorld()
        world.byId.set(IN_FORCE.id, IN_FORCE)

        const filed = await world.requests.propose(
            facts.WS,
            liveRequest({ subjectLabel: PHI_SHIP_VI, attributeLabel: NOI_THANH_VI, replaces: IN_FORCE.id }),
        )

        expect(world.store.propose.mock.calls[0]?.[1]).toMatchObject({
            subjectLabel: DELIVERY_SUBJECT_LABEL_VI,
            attributeLabel: PHI_GIAO_HANG_VI,
            installationId: null,
        })
        expect(world.payloadOf(filed.fact.id)).toMatchObject({ kind: "change", current: { value: DELIVERY_FEE_VALUE_VI, match: "same" } })
    })
})

describe("FX5 D-P11-8a: refusing a replaced fact that is not the instance's in force, and a near meaning shown as may replace", () => {
    it.each([
        ["a fact that does not exist", "nope", null],
        ["a fact no longer in force", "641d02da", "superseded"],
        ["a fact kept for another instance", "641d02da", "other-instance"],
    ])("refuses replaces naming %s: nothing filed, no card", async (_name, id, twist) => {
        const world = await buildChangeWorld()
        if (twist === "superseded") world.byId.set(IN_FORCE.id, { ...IN_FORCE, status: "superseded" })
        if (twist === "other-instance") world.byId.set(IN_FORCE.id, { ...IN_FORCE, installationId: "inst-front-desk" })

        await expect(world.requests.propose(facts.WS, liveRequest({ replaces: id }))).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactNotFound,
            params: { field: "replaces" },
        })
        expect(world.store.propose).not.toHaveBeenCalled()
        expect(world.lines.size).toBe(0)
    })

    it("no id, no key: a fact in force near in meaning is shown as 'may replace', never merged; approving replaces it", async () => {
        const world = await buildChangeWorld()
        world.byId.set(IN_FORCE.id, IN_FORCE)
        world.vectors.nearestInForce.mockResolvedValue(IN_FORCE)

        const filed = await world.requests.propose(
            facts.WS,
            liveRequest({ subjectLabel: PHI_VAN_CHUYEN_VI, attributeLabel: TRONG_THANH_PHO_VI, installationId: null }),
        )

        expect(world.store.flagSameMeaning).toHaveBeenCalledWith(facts.WS, filed.fact.id, IN_FORCE.id)
        expect(world.payloadOf(filed.fact.id)).toMatchObject({
            kind: "change",
            factKey: { subjectLabel: PHI_VAN_CHUYEN_VI, attributeLabel: TRONG_THANH_PHO_VI },
            current: {
                value: DELIVERY_FEE_VALUE_VI,
                version: 1,
                match: "near",
                factKey: { subjectLabel: DELIVERY_SUBJECT_LABEL_VI, attributeLabel: PHI_GIAO_HANG_VI },
            },
        })
        const stored = JSON.stringify(world.lines.get(brainChangeKeyOf(filed.fact.id))?.message)
        expect(brainChangeCardViewOf(stored, "owner")).toMatchObject({ canApprove: true, canKeepBoth: true })
        expect(brainChangeCardViewOf(stored, "manager")).toMatchObject({ canApprove: false, canKeepBoth: false })
        // Nothing applied or merged by filing.
        expect(world.store.apply).not.toHaveBeenCalled()
        expect(world.brain.decideFact).not.toHaveBeenCalled()

        await expect(
            world.service.decide(OWNER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "approve" }),
        ).resolves.toMatchObject({ outcome: "applied" })
        // Approving chooses the flagged proposal: W2's apply merges over the named fact (same_meaning kept).
        expect(world.store.keepApart).not.toHaveBeenCalled()
        expect(world.brain.decideFact).toHaveBeenCalledWith(OWNER, expect.objectContaining({ action: "choose" }))
    })
})

describe("FX5 D-P11-8a: keeping both", () => {
    it("keeping both lets the candidate go before choosing: the new value is its own truth, the other one stays", async () => {
        const world = await buildChangeWorld()
        world.byId.set(IN_FORCE.id, IN_FORCE)
        world.vectors.nearestInForce.mockResolvedValue(IN_FORCE)
        const filed = await world.requests.propose(
            facts.WS,
            liveRequest({ subjectLabel: GIAO_HANG_HOA_TOC_VI, attributeLabel: PHI_VI, installationId: null }),
        )

        await expect(
            world.service.decide(MANAGER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "keep_both" }),
        ).resolves.toMatchObject({ outcome: "founder_only" })
        await expect(
            world.service.decide(OWNER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "keep_both" }),
        ).resolves.toEqual({ outcome: "applied", state: "applied", revision: 2 })

        const apart = world.store.keepApart.mock.invocationCallOrder[0] ?? Infinity
        const chosen = world.brain.decideFact.mock.invocationCallOrder[0] ?? -Infinity
        expect(apart).toBeLessThan(chosen)
        expect(world.store.keepApart).toHaveBeenCalledWith(facts.WS, filed.fact.id)
        expect(world.byId.get(IN_FORCE.id)?.status).toBe("active")
    })

    it("keeping both on a card of the same truth is not offered and changes nothing", async () => {
        const world = await buildChangeWorld()
        world.byId.set(IN_FORCE.id, IN_FORCE)
        const filed = await world.requests.propose(facts.WS, liveRequest())

        await expect(
            world.service.decide(OWNER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "keep_both" }),
        ).resolves.toEqual({ outcome: "not_offered", state: "open", revision: 1 })
        expect(world.brain.decideFact).not.toHaveBeenCalled()
        expect(world.store.keepApart).not.toHaveBeenCalled()
    })
})
