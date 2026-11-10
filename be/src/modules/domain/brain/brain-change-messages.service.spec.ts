import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { FakeClock, mock } from "@starci/jest-preset"
import { BrainChangeRequestsService, BrainFactsErrorCode, BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord, ReasonedChangeRequest } from "@modules/domain/brain-facts"
import { TeamChatAudienceService, TeamChatCardsService, TeamChatStoreService } from "@modules/domain/team-chat"
import type { TeamCardMessage } from "@modules/domain/team-chat"
import { brainChangeKeyOf, brainChangeCardViewOf } from "@modules/domain/team-chat/brain-change-card.policy"
import type { BrainChangePayload } from "@modules/domain/team-chat/brain-change-card.contracts"
import { WorkspaceMembersReadService, WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { BrainChangeMessagesService } from "./brain-change-messages.service"
import type { BrainChangePost } from "./brain-change-messages.service"
import { BrainService } from "./brain.service"

const LINE = "55555555-5555-4555-8555-555555555555"
const ROOM = "room-direct-owner-sales"
const OWNER = "u-owner"
const MANAGER = "u-manager"
const SAID_AT = new Date("2026-11-11T10:40:00.000Z")
const REASON = "Anh vừa nhắn từ mai phí ship nội thành là 30k, thay giá 20.000 đ đang dùng (bản 2); không nói thời hạn."

const memberOf = (userId: string, role: WorkspaceMember["role"]): WorkspaceMember => ({
    userId,
    workspaceId: facts.WS,
    role,
    staffId: null,
    displayName: userId === OWNER ? "nivo-owner" : "Lan",
    status: "active",
})

const ACTIVE = facts.factOf({
    id: "f-ship",
    subjectKey: "giao-hang",
    attribute: "phi-ship-noi-thanh",
    subjectLabel: "Giao hàng",
    attributeLabel: "Phí ship nội thành",
    value: "20.000 đ",
    status: "active",
    version: 2,
    evidence: [{ kind: "document", ref: "doc-ship", label: "Quy định", title: "Quy định giao hàng.docx" }],
})

const proposalOf = (id: string, value: string, changes: Partial<FactRecord> = {}): FactRecord => ({
    ...facts.factOf({
        id,
        subjectKey: "giao-hang",
        attribute: "phi-ship-noi-thanh",
        subjectLabel: "Giao hàng",
        attributeLabel: "Phí ship nội thành",
        value,
        status: "proposed",
        conflictWith: "f-ship",
    }),
    ...changes,
})

/** The team chat as a map of lines by client id: posting once per key, folding in place. */
const chatWorld = () => {
    const lines = new Map<string, { id: string; roomId: string; message: TeamCardMessage }>()
    const audience = mock<TeamChatAudienceService>()
    const cards = mock<TeamChatCardsService>()
    audience.storedCard.mockImplementation(async (_ws, key) => lines.get(key)?.message ?? null)
    audience.foldTeamCard.mockImplementation(async (_ws, key, message) => {
        const line = lines.get(key)
        if (line === undefined) return null
        lines.set(key, { ...line, message })
        return line.id
    })
    const posted = (roomId: string, key: string, agentMessage: string) => {
        const kept = lines.get(key)
        if (kept !== undefined) return { roomId: kept.roomId, messageId: kept.id }
        const id = `msg-${lines.size + 1}`
        lines.set(key, { id, roomId, message: JSON.parse(agentMessage) as TeamCardMessage })
        return { roomId, messageId: id }
    }
    cards.postMessage.mockImplementation(async (_ws, line) => posted(line.roomId ?? "", line.key ?? "", line.agentMessage ?? ""))
    cards.postAsAgent.mockImplementation(async (_ws, post) => ({
        ...posted("room-founder-direct", post.key ?? "", post.agentMessage ?? ""),
        agentId: post.agent,
    }))
    const payloadOf = (changeId: string): BrainChangePayload =>
        lines.get(brainChangeKeyOf(changeId))?.message.payload as BrainChangePayload
    return { lines, audience, cards, payloadOf }
}

const build = () => {
    const chat = chatWorld()
    const store = mock<BrainFactsService>()
    const byId = new Map<string, FactRecord>([[ACTIVE.id, ACTIVE]])
    store.get.mockImplementation(async (_ws, id) => byId.get(id) ?? null)
    store.byKey.mockImplementation(async (_ws, _subject, attribute, status) =>
        [...byId.values()].filter((fact) => fact.status === status && fact.attribute === attribute),
    )
    store.propose.mockImplementation(async (_ws, input) => {
        const fact = proposalOf(`p-${byId.size}`, input.value)
        byId.set(fact.id, fact)
        return { fact, outcome: "conflict" }
    })
    const clock = new FakeClock("2026-11-11T10:45:00.000Z")
    const requests = new BrainChangeRequestsService(clock, store)
    const teamStore = mock<TeamChatStoreService>()
    teamStore.messagesByIds.mockImplementation(async (_ws, ids) =>
        ids[0] === LINE
            ? [{ id: LINE, roomId: ROOM, authorKind: "user", authorId: OWNER, createdAt: SAID_AT } as never]
            : [],
    )
    const people = mock<WorkspaceMembersReadService>()
    people.namesOf.mockResolvedValue([{ userId: OWNER, displayName: "nivo-owner" }])
    const members = mock<WorkspaceMembersService>()
    members.require.mockImplementation(async (userId) => memberOf(userId, userId === OWNER ? "owner" : "manager"))
    const brain = mock<BrainService>()
    brain.decideFact.mockImplementation(async (_userId, decision) => {
        const fact = byId.get(decision.id)!
        const decided = { ...fact, status: decision.action === "reject" ? "rejected" : "active" } as FactRecord
        byId.set(fact.id, decided)
        return decided
    })
    const service = new BrainChangeMessagesService(
        clock,
        requests,
        store,
        brain,
        chat.audience,
        chat.cards,
        teamStore,
        members,
        people,
    )
    service.onModuleInit()
    return { ...chat, service, requests, store, brain, byId }
}

const requestOf = (changes: Partial<ReasonedChangeRequest> = {}): ReasonedChangeRequest => ({
    subjectLabel: "Giao hàng",
    attributeLabel: "Phí ship nội thành",
    value: "30.000 đ",
    room: "direct",
    messageId: LINE,
    quote: "từ mai phí ship nội thành là 30k nhé",
    reason: REASON,
    proposedBy: "sales",
    agentId: "agent-sales",
    installationId: null,
    ...changes,
})

describe("BrainChangeMessagesService: filing from a chat posts ONE card in the room it came from", () => {
    it("posts the card once: old → new, the reason, the quoted line with who and when, open, revision 1", async () => {
        const world = build()

        const filed = await world.requests.propose(facts.WS, requestOf())

        expect(world.cards.postMessage).toHaveBeenCalledTimes(1)
        expect(world.cards.postMessage.mock.calls[0]?.[1]).toMatchObject({ authorAgentId: "agent-sales", roomId: ROOM })
        expect(world.payloadOf(filed.fact.id)).toEqual({
            version: 1,
            changeId: filed.fact.id,
            origin: "chat",
            kind: "change",
            factKey: { subjectLabel: "Giao hàng", attributeLabel: "Phí ship nội thành" },
            oldValue: "20.000 đ",
            current: { value: "20.000 đ", version: 2, source: "Quy định giao hàng.docx" },
            newValue: "30.000 đ",
            unit: null,
            validFrom: null,
            validTo: null,
            reason: REASON,
            evidence: [
                {
                    kind: "message",
                    quote: "từ mai phí ship nội thành là 30k nhé",
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
        const world = build()
        const first = await world.requests.propose(facts.WS, requestOf())
        world.store.propose.mockResolvedValue({ fact: first.fact, outcome: "conflict" })

        await world.service.post({
            workspaceId: facts.WS,
            changeId: first.fact.id,
            origin: "chat",
            reason: REASON,
            evidence: [{ kind: "message", quote: "nhớ nha, 30k", ref: "team-chat:other", by: { name: "nivo-owner", memberId: OWNER }, at: null }],
            agentId: "agent-sales",
            roomId: ROOM,
        })

        expect(world.lines.size).toBe(1)
        expect(world.payloadOf(first.fact.id)).toMatchObject({ revision: 2, state: "open" })
        expect(world.payloadOf(first.fact.id).evidence).toHaveLength(2)
    })

    it("posts no card when the value in force already says it", async () => {
        const world = build()

        await expect(world.requests.propose(facts.WS, requestOf({ value: "20.000 đ" }))).resolves.toMatchObject({
            outcome: "already_true",
        })
        expect(world.lines.size).toBe(0)
    })

    it("supersedes the open card of the same truth when a newer proposal comes, never stacking two open cards", async () => {
        const world = build()
        const first = await world.requests.propose(facts.WS, requestOf())
        const second = await world.requests.propose(
            facts.WS,
            requestOf({ value: "35.000 đ", reason: "Anh sửa lại: phí ship nội thành là 35k chứ không phải 30k như lúc nãy." }),
        )

        expect(world.payloadOf(first.fact.id)).toMatchObject({ state: "superseded", supersededBy: second.fact.id, revision: 2 })
        expect(world.payloadOf(second.fact.id)).toMatchObject({ state: "open", newValue: "35.000 đ", revision: 1 })
        const open = [...world.lines.values()].filter((line) => (line.message.payload as BrainChangePayload).state === "open")
        expect(open).toHaveLength(1)
    })
})

describe("BrainChangeMessagesService: refusals", () => {
    it("refuses words that are not a person's line of the team chat (a customer conversation never is): nothing filed, no card", async () => {
        const world = build()

        await expect(world.requests.propose(facts.WS, requestOf({ messageId: "66666666-6666-4666-8666-666666666666" }))).rejects.toMatchObject({
            code: BrainFactsErrorCode.FactNotFound,
        })
        expect(world.store.propose).not.toHaveBeenCalled()
        expect(world.lines.size).toBe(0)
    })

    it.each([
        ["an empty reason", ""],
        ["a copy of the value", "30.000 đ, phí ship"],
    ])("refuses a post with %s (learning and document posts too)", async (_name, reason) => {
        const world = build()
        const proposal = proposalOf("p-x", "30.000 đ, phí ship")
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
        const world = build()
        const proposal = proposalOf("p-express", "Phụ phí 15.000 đ", { conflictWith: null, attribute: "giao-hoa-toc" })
        world.byId.set(proposal.id, proposal)

        const posted = await world.service.post({
            workspaceId: facts.WS,
            changeId: proposal.id,
            origin: "learning",
            reason: "Em học từ 3 lần anh chị trả lời giống nhau khi khách hỏi giao hỏa tốc buổi tối.",
            evidence: [
                { kind: "answer", quote: "sau 6h tối thêm 15k nha em", ref: "agent.run-stop:s1", by: { name: "Anh", memberId: OWNER }, at: null },
                { kind: "answer", quote: "sau 18h phụ phí 15k", ref: "agent.run-stop:s3", by: { name: "Lan", memberId: MANAGER }, at: null },
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
    it("Đồng ý by the owner applies through W2's founder-only path and rewrites the same card applied, with who and when", async () => {
        const world = build()
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

    it("refuses a manager's Đồng ý with a clear outcome and changes nothing; the manager may say Không", async () => {
        const world = build()
        const filed = await world.requests.propose(facts.WS, requestOf())

        await expect(
            world.service.decide(MANAGER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "approve" }),
        ).resolves.toEqual({ outcome: "founder_only", state: "open", revision: 1 })
        expect(world.brain.decideFact).not.toHaveBeenCalled()

        await expect(
            world.service.decide(MANAGER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "reject", note: "chưa chốt" }),
        ).resolves.toEqual({ outcome: "rejected", state: "rejected", revision: 2 })
        expect(world.payloadOf(filed.fact.id).decidedBy).toMatchObject({ memberId: MANAGER, name: "Lan" })
    })

    it("answers already_decided on a second click and leaves the card as decided", async () => {
        const world = build()
        const filed = await world.requests.propose(facts.WS, requestOf())
        await world.service.decide(OWNER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "reject" })

        await expect(
            world.service.decide(OWNER, { workspaceId: facts.WS, changeId: filed.fact.id, action: "approve" }),
        ).resolves.toEqual({ outcome: "already_decided", state: "rejected", revision: 2 })
        expect(world.brain.decideFact).toHaveBeenCalledTimes(1)
    })

    it("follows a decision taken on the Second Brain page: the open card is rewritten applied", async () => {
        const world = build()
        const filed = await world.requests.propose(facts.WS, requestOf())

        await world.service.follow(facts.WS, { ...filed.fact, status: "active", decidedBy: "nivo-owner", decidedAt: "2026-11-11T11:00:00.000Z" })

        expect(world.payloadOf(filed.fact.id)).toMatchObject({ state: "applied", revision: 2, decidedBy: { name: "nivo-owner" } })
    })

    it("answers not_found for a request with no card", async () => {
        const world = build()

        await expect(world.service.decide(OWNER, { workspaceId: facts.WS, changeId: "nope", action: "approve" })).resolves.toEqual({
            outcome: "not_found",
            state: null,
            revision: null,
        })
    })
})
