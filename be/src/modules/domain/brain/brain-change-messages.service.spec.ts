import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { BrainFactsErrorCode } from "@modules/domain/brain-facts"
import { WorkspaceMembersError, WorkspaceMembersErrorCode } from "@modules/domain/workspace-members/errors/workspace-members.error"
import { brainChangeCardViewOf, brainChangeKeyOf } from "@modules/domain/team-chat"
import type { BrainChangePost } from "./brain-change-messages.service"
import { ACTIVE, LINE, MANAGER, OWNER, ROOM, SAID_AT, buildChangeWorld, memberOf, payloadOfMessage, proposalOf, requestOf } from "@tests/fixtures/builders/brain.builder"
import { ANH_VUA_NHAN_TU_MAI_PHI_VI, ANH_SUA_LAI_PHI_SHIP_NOI_VI, CHUA_CHOT_VI, D_VI, EM_HOC_TU_3_LAN_ANH_VI, GIAO_HANG_PHI_SHIP_NOI_THANH_VI, NHO_NHA_30K_VI, OK_EM_MAI_ANH_GHE_TIEM_VI, PHI_SHIP_NOI_THANH_VI, PHU_PHI_15_000_D_VI, QUY_DINH_GIAO_HANG_DOCX_VI, SAU_18H_PHU_PHI_15K_VI, SAU_6H_TOI_THEM_15K_NHA_VI, TU_GIO_PHI_SHIP_NOI_THANH_VI, TU_MAI_PHI_SHIP_NOI_THANH_VI, T_20_000_D_VI, T_30_000_D_PHI_SHIP_VI, T_30_000_D_VI, T_32_000_D_MOT_DON_VI, T_35_000_D_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { DELIVERY_GROUP_LABEL_VI } from "@tests/fixtures/i18n/brain-spec.messages"

describe("BrainChangeMessagesService: filing from a chat posts ONE card in the room it came from", () => {
    it("posts the card once: old to new, the reason, the quoted line with who and when, open, revision 1", async () => {
        const world = await buildChangeWorld()

        const filed = await world.requests.propose(facts.WS, requestOf())

        expect(world.cards.postMessage).toHaveBeenCalledTimes(1)
        expect(world.cards.postMessage.mock.calls[0]?.[1]).toMatchObject({ authorAgentId: "agent-sales", roomId: ROOM })
        expect(world.payloadOf(filed.fact.id)).toEqual({
            version: 1,
            changeId: filed.fact.id,
            origin: "chat",
            kind: "change",
            factKey: { subjectLabel: DELIVERY_GROUP_LABEL_VI, attributeLabel: PHI_SHIP_NOI_THANH_VI },
            oldValue: T_20_000_D_VI,
            current: {
                value: T_20_000_D_VI,
                version: 2,
                source: QUY_DINH_GIAO_HANG_DOCX_VI,
                match: "same",
                factKey: { subjectLabel: DELIVERY_GROUP_LABEL_VI, attributeLabel: PHI_SHIP_NOI_THANH_VI },
            },
            newValue: T_30_000_D_VI,
            unit: null,
            validFrom: null,
            validTo: null,
            reason: ANH_VUA_NHAN_TU_MAI_PHI_VI,
            evidence: [
                {
                    kind: "message",
                    quote: TU_MAI_PHI_SHIP_NOI_THANH_VI,
                    ref: `team-chat:${LINE}`,
                    by: { name: "nivo-owner", memberId: OWNER },
                    at: SAID_AT.toISOString(),
                },
            ],
            state: "open",
            decidedBy: null,
            supersededBy: null,
            revision: 1,
        })
        // The card never applies anything.
        expect(world.store.apply).not.toHaveBeenCalled()
        expect(world.brain.decideFact).not.toHaveBeenCalled()
    })

    it("posts nothing more for the same request again: the same card is rewritten (one more revision)", async () => {
        const world = await buildChangeWorld()
        const first = await world.requests.propose(facts.WS, requestOf())
        world.store.propose.mockResolvedValue({ fact: first.fact, outcome: "conflict" })

        await world.service.post({
            workspaceId: facts.WS,
            changeId: first.fact.id,
            origin: "chat",
            reason: ANH_VUA_NHAN_TU_MAI_PHI_VI,
            evidence: [{ kind: "message", quote: NHO_NHA_30K_VI, ref: "team-chat:other", by: { name: "nivo-owner", memberId: OWNER }, at: null }],
            agentId: "agent-sales",
            roomId: ROOM,
        })

        expect(world.lines.size).toBe(1)
        expect(world.payloadOf(first.fact.id)).toMatchObject({ revision: 2, state: "open" })
        expect(world.payloadOf(first.fact.id).evidence).toHaveLength(2)
    })
})

describe("BrainChangeMessagesService: filing again and filing over an open card", () => {
    it("posts no card when the value in force already says it", async () => {
        const world = await buildChangeWorld()

        await expect(world.requests.propose(facts.WS, requestOf({ value: T_20_000_D_VI }))).resolves.toMatchObject({
            outcome: "already_true",
        })
        expect(world.lines.size).toBe(0)
    })

    it("supersedes the open card of the same truth when a newer proposal comes, never stacking two open cards", async () => {
        const world = await buildChangeWorld()
        const first = await world.requests.propose(facts.WS, requestOf())
        const second = await world.requests.propose(
            facts.WS,
            requestOf({ value: T_35_000_D_VI, reason: ANH_SUA_LAI_PHI_SHIP_NOI_VI }),
        )

        expect(world.payloadOf(first.fact.id)).toMatchObject({ state: "superseded", supersededBy: second.fact.id, revision: 2 })
        expect(world.payloadOf(second.fact.id)).toMatchObject({ state: "open", newValue: T_35_000_D_VI, revision: 1 })
        const open = [...world.lines.values()].filter((line) => payloadOfMessage(line.message).state === "open")
        expect(open).toHaveLength(1)
    })
})

describe("BrainChangeMessagesService: refusals", () => {
    it("refuses words that are not a person's line of the team chat (a customer conversation never is): nothing filed, no card", async () => {
        const world = await buildChangeWorld()

        await expect(world.requests.propose(facts.WS, requestOf({ messageId: "66666666-6666-4666-8666-666666666666" }))).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactNotFound,
        })
        expect(world.store.propose).not.toHaveBeenCalled()
        expect(world.lines.size).toBe(0)
    })

    it.each([
        ["an empty reason", ""],
        ["a copy of the value", T_30_000_D_PHI_SHIP_VI],
    ])("refuses a post with %s (learning and document posts too)", async (_name, reason) => {
        const world = await buildChangeWorld()
        const proposal = proposalOf("p-x", T_30_000_D_PHI_SHIP_VI)
        world.byId.set(proposal.id, proposal)
        const post: BrainChangePost = {
            workspaceId: facts.WS,
            changeId: proposal.id,
            origin: "learning",
            reason,
            evidence: [{ kind: "answer", quote: "30k nha", ref: "agent.run-stop:s1", by: { name: "Anh", memberId: OWNER }, at: null }],
            agentId: "agent-sales",
            roomId: null,
        }

        await expect(world.service.post(post)).rejects.toMatchObject({ code: BrainFactsErrorCode.FactIncomplete })
        expect(world.lines.size).toBe(0)
    })

    it("posts a learning card into the founder's direct room with the agent, free of any chat message", async () => {
        const world = await buildChangeWorld()
        const proposal = proposalOf("p-express", PHU_PHI_15_000_D_VI, { conflictWith: null, attribute: "giao-hoa-toc" })
        world.byId.set(proposal.id, proposal)

        const posted = await world.service.post({
            workspaceId: facts.WS,
            changeId: proposal.id,
            origin: "learning",
            reason: EM_HOC_TU_3_LAN_ANH_VI,
            evidence: [
                { kind: "answer", quote: SAU_6H_TOI_THEM_15K_NHA_VI, ref: "agent.run-stop:s1", by: { name: "Anh", memberId: OWNER }, at: null },
                { kind: "answer", quote: SAU_18H_PHU_PHI_15K_VI, ref: "agent.run-stop:s3", by: { name: "Lan", memberId: MANAGER }, at: null },
            ],
            agentId: "agent-sales",
            roomId: null,
        })

        expect(posted).toMatchObject({ outcome: "posted", superseded: [] })
        expect(world.cards.postAsAgent).toHaveBeenCalledTimes(1)
        expect(world.payloadOf(proposal.id)).toMatchObject({ origin: "learning", kind: "add", current: null, oldValue: null })
    })
})

describe("BrainChangeMessagesService: the founder decides on the card, rewritten in place", () => {
    it("approving by the owner applies through W2's founder-only path and rewrites the same card applied, with who and when", async () => {
        const world = await buildChangeWorld()
        const filed = await world.requests.propose(facts.WS, requestOf())

        await expect(
            world.service.decide(OWNER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "approve" }),
        ).resolves.toEqual({ outcome: "applied", state: "applied", revision: 2 })

        expect(world.brain.decideFact).toHaveBeenCalledWith(OWNER, {
            workspaceId: facts.WS,
            id: filed.fact.id,
            action: "choose",
            note: undefined,
        })
        expect(world.lines.size).toBe(1)
        expect(world.payloadOf(filed.fact.id)).toMatchObject({
            state: "applied",
            decidedBy: { memberId: OWNER, name: "nivo-owner", at: "2026-11-11T10:45:00.000Z" },
        })
        const stored = JSON.stringify(world.lines.get(brainChangeKeyOf(filed.fact.id))?.message)
        expect(brainChangeCardViewOf(stored, "owner")).toMatchObject({ canApprove: false, canReject: false })
    })

    it("refuses a manager's approval with a clear outcome and changes nothing; the manager may reject", async () => {
        const world = await buildChangeWorld()
        const filed = await world.requests.propose(facts.WS, requestOf())

        await expect(
            world.service.decide(MANAGER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "approve" }),
        ).resolves.toEqual({ outcome: "founder_only", state: "open", revision: 1 })
        expect(world.brain.decideFact).not.toHaveBeenCalled()

        await expect(
            world.service.decide(MANAGER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "reject", note: CHUA_CHOT_VI }),
        ).resolves.toEqual({ outcome: "rejected", state: "rejected", revision: 2 })
        expect(world.payloadOf(filed.fact.id).decidedBy).toMatchObject({ memberId: MANAGER, name: "Lan" })
    })

    it("answers already_decided on a second click and leaves the card as decided", async () => {
        const world = await buildChangeWorld()
        const filed = await world.requests.propose(facts.WS, requestOf())
        await world.service.decide(OWNER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "reject" })

        await expect(
            world.service.decide(OWNER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "approve" }),
        ).resolves.toEqual({ outcome: "already_decided", state: "rejected", revision: 2 })
        expect(world.brain.decideFact).toHaveBeenCalledTimes(1)
    })

    it("follows a decision taken on the Second Brain page: the open card is rewritten applied", async () => {
        const world = await buildChangeWorld()
        const filed = await world.requests.propose(facts.WS, requestOf())

        await world.service.follow(facts.WS, { ...filed.fact, status: "active", decidedBy: "nivo-owner", decidedAt: "2026-11-11T11:00:00.000Z" })

        expect(world.payloadOf(filed.fact.id)).toMatchObject({ state: "applied", revision: 2, decidedBy: { name: "nivo-owner" } })
    })

    it("answers not_found for a request with no card", async () => {
        const world = await buildChangeWorld()

        await expect(world.service.decide(OWNER, { workspaceId: facts.WS, changeId: "nope", action: "approve" })).resolves.toEqual({
            outcome: "not_found",
            state: null,
            revision: null,
        })
    })
})

describe("D-T5-1: the card reads the value and its unit once, on both sides", () => {
    it("the live case: the value in force kept its unit apart, the agent's value names it: 30,000 dong to 32,000 dong an order", async () => {
        const world = await buildChangeWorld()
        // The value in force as the policy tab writes it (the unit apart); the store answers the proposal in its normal form.
        world.byId.set(ACTIVE.id, { ...ACTIVE, value: "30.000", unit: D_VI })

        const filed = await world.requests.propose(
            facts.WS,
            requestOf({ value: T_32_000_D_MOT_DON_VI, unit: D_VI, quote: TU_GIO_PHI_SHIP_NOI_THANH_VI }),
        )

        expect(world.payloadOf(filed.fact.id)).toMatchObject({
            oldValue: T_30_000_D_VI,
            current: { value: T_30_000_D_VI },
            newValue: T_32_000_D_MOT_DON_VI,
            unit: null,
        })
        const card = world.lines.get(brainChangeKeyOf(filed.fact.id))?.message
        expect(card?.summary).toBe(GIAO_HANG_PHI_SHIP_NOI_THANH_VI)
    })
})

describe("Owner order 2026-11-11 item 1: a change request is filed by WHO said it, read from the chat line", () => {
    it("files the founder's own words as an owner source (trust 95 in the store), still waiting for his yes on the card", async () => {
        const world = await buildChangeWorld()

        await world.requests.propose(facts.WS, requestOf())

        expect(world.store.propose.mock.calls[0]?.[1]).toMatchObject({ sourceKind: "owner", autoApply: false })
        expect(world.cards.postMessage).toHaveBeenCalledTimes(1)
    })

    it("files a manager's words as a manager source and a staff member's as staff, whatever the agent relays", async () => {
        const manager = await buildChangeWorld()
        manager.said.authorId = MANAGER
        await manager.requests.propose(facts.WS, requestOf())
        expect(manager.store.propose.mock.calls[0]?.[1]).toMatchObject({ sourceKind: "manager" })

        const staff = await buildChangeWorld()
        staff.said.authorId = "u-staff"
        staff.members.require.mockImplementation((userId) => Promise.resolve(memberOf(userId, "staff")))
        await staff.requests.propose(facts.WS, requestOf())
        expect(staff.store.propose.mock.calls[0]?.[1]).toMatchObject({ sourceKind: "staff" })
    })

    it("counts an author who is no active member any more as staff", async () => {
        const world = await buildChangeWorld()
        world.said.authorId = "u-gone"
        world.members.require.mockRejectedValue(new WorkspaceMembersError({ code: WorkspaceMembersErrorCode.NotMember }))

        await world.requests.propose(facts.WS, requestOf())

        expect(world.store.propose.mock.calls[0]?.[1]).toMatchObject({ sourceKind: "staff" })
    })

    it("refuses words the quoted line does not hold: the model cannot borrow the founder's line for someone else's words", async () => {
        const world = await buildChangeWorld()
        world.said.body = OK_EM_MAI_ANH_GHE_TIEM_VI

        await expect(world.requests.propose(facts.WS, requestOf())).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactNotFound,
            params: { field: "quote" },
        })
        expect(world.store.propose).not.toHaveBeenCalled()
        expect(world.cards.postMessage).not.toHaveBeenCalled()
    })

    it("matches the quote with accents, case and punctuation aside", async () => {
        const world = await buildChangeWorld()

        await world.requests.propose(facts.WS, requestOf({ quote: "TU MAI PHI SHIP NOI THANH LA 30K" }))

        expect(world.store.propose).toHaveBeenCalledTimes(1)
    })
})

describe("D-BR-6: the card names a planned value as what is planned", () => {
    it("a founder line about a truth whose only value is planned: kind change, Current = the plan with its start, filed in its window", async () => {
        const world = await buildChangeWorld()
        const plan = { ...ACTIVE, id: "f-plan", status: "scheduled" as const, value: T_30_000_D_VI, scope: "public" as const,
            validFrom: "2027-02-12T00:00:00.000Z", validTo: "2027-02-15T00:00:00.000Z" }
        world.byId.set(ACTIVE.id, { ...ACTIVE, status: "superseded" })
        world.byId.set(plan.id, plan)

        const filed = await world.requests.propose(facts.WS, requestOf({ value: T_35_000_D_VI }))

        const card = world.payloadOf(filed.fact.id)
        expect(card.kind).toBe("change")
        expect(card.current).toMatchObject({ value: T_30_000_D_VI, match: "same", startsAt: "2027-02-12T00:00:00.000Z" })
        expect(filed.fact).toMatchObject({ validFrom: "2027-02-12T00:00:00.000Z", scope: "public" })
    })

    it("a value in force now carries no start", async () => {
        const world = await buildChangeWorld()

        const filed = await world.requests.propose(facts.WS, requestOf())

        expect(world.payloadOf(filed.fact.id).current).not.toHaveProperty("startsAt")
    })
})
