import { Test } from "@nestjs/testing"
import { FakeClock, mock, type MockOf } from "@starci/jest-preset"
import * as facts from "@tests/fixtures/builders/brain-facts.builder"
import { BrainChangeRequestsService, BrainFactsError, BrainFactsErrorCode, BrainFactsService, factSlugOf, type FactRecord, type ReasonedChangeRequest } from "@modules/domain/brain-facts"
import { BrainChangeMessagesService, BrainService } from "@modules/domain/brain"
import { FactEmbeddingsService } from "@modules/domain/brain/fact-embeddings.service"
import { TeamChatAudienceService, TeamChatCardsService, TeamChatStoreService, brainChangeKeyOf, type BrainChangePayload, type TeamCardMessage } from "@modules/domain/team-chat"
import { WorkspaceMembersReadService, WorkspaceMembersService, type WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { parseJsonText } from "@modules/platform/primitives"
import { ANH_VUA_NHAN_TU_MAI_PHI_VI, EM_OI_TU_MAI_PHI_SHIP_VI, PHI_SHIP_NOI_THANH_VI, QUY_DINH_GIAO_HANG_DOCX_VI, QUY_DINH_VI, TU_MAI_PHI_SHIP_NOI_THANH_VI, T_20_000_D_VI, T_30_000_D_VI } from "@tests/fixtures/i18n/brain-a-spec.messages"
import { DELIVERY_GROUP_LABEL_VI } from "@tests/fixtures/i18n/brain-spec.messages"

/** The id of the chat line the requests quote. */
export const LINE = "55555555-5555-4555-8555-555555555555"
/** The founder's direct room with the Sales agent. */
export const ROOM = "room-direct-owner-sales"
/** The workspace owner. */
export const OWNER = "u-owner"
/** A workspace manager. */
export const MANAGER = "u-manager"
/** When the quoted line was said. */
export const SAID_AT: Date = new Date("2026-11-11T10:40:00.000Z")

/** A member of the workspace with the given role. */
export const memberOf = (userId: string, role: WorkspaceMember["role"]): WorkspaceMember => ({
    userId,
    workspaceId: facts.WS,
    role,
    staffId: null,
    displayName: userId === OWNER ? "nivo-owner" : "Lan",
    status: "active",
})

/** The delivery fee in force, version 2, from a document. */
export const ACTIVE: FactRecord = facts.factOf({
    id: "f-ship",
    subjectKey: "giao-hang",
    attribute: "phi-ship-noi-thanh",
    subjectLabel: DELIVERY_GROUP_LABEL_VI,
    attributeLabel: PHI_SHIP_NOI_THANH_VI,
    value: T_20_000_D_VI,
    status: "active",
    version: 2,
    evidence: [{ kind: "document", ref: "doc-ship", label: QUY_DINH_VI, title: QUY_DINH_GIAO_HANG_DOCX_VI }],
})

/** A proposal against the fee in force. */
export const proposalOf = (id: string, value: string, changes: Partial<FactRecord> = {}): FactRecord => ({
    ...facts.factOf({
        id,
        subjectKey: "giao-hang",
        attribute: "phi-ship-noi-thanh",
        subjectLabel: DELIVERY_GROUP_LABEL_VI,
        attributeLabel: PHI_SHIP_NOI_THANH_VI,
        value,
        status: "proposed",
        conflictWith: "f-ship",
    }),
    ...changes,
})

/** The row the team chat store answers for the quoted line. */
type ChatLineRow = Awaited<ReturnType<TeamChatStoreService["messagesByIds"]>>[number]

/** The empty card a missing line reads as. */
const NO_CARD: TeamCardMessage = { kind: "", intent: "", title: "", summary: "", payload: null }

/** Whether a parsed value is a card message. */
const isTeamCardMessage = (value: unknown): value is TeamCardMessage =>
    typeof value === "object" &&
    value !== null &&
    ["kind", "intent", "title", "summary"].every((key) => typeof Reflect.get(value, key) === "string")

/** Whether a card payload is the payload of a brain change card. */
const isBrainChangePayload = (value: unknown): value is BrainChangePayload =>
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "changeId") === "string" &&
    typeof Reflect.get(value, "state") === "string" &&
    typeof Reflect.get(value, "revision") === "number"

/** Fails the spec when a card payload is not a brain change payload; narrows it otherwise. */
const assertChangePayload: (value: unknown) => asserts value is BrainChangePayload = (value) => {
    expect(isBrainChangePayload(value)).toBe(true)
}

/** The brain change payload a card message carries. */
export const payloadOfMessage = (message: TeamCardMessage): BrainChangePayload => {
    const payload = message.payload
    assertChangePayload(payload)
    return payload
}

/** The card a posted agent message holds, read back from its JSON text. */
const cardOfText = (agentMessage: string): TeamCardMessage => {
    const read = parseJsonText(agentMessage)
    const card = read.ok && isTeamCardMessage(read.value) ? read.value : null
    expect(card).not.toBeNull()
    return card ?? NO_CARD
}

/** One line of the team chat: its id, its room and the card message it holds. */
interface ChatCardLine {
    readonly id: string
    readonly roomId: string
    readonly message: TeamCardMessage
}

/** The team chat world: the lines by client id, the doubles that post and fold them, and the reader of a change payload. */
interface ChatWorld {
    readonly lines: Map<string, ChatCardLine>
    readonly audience: MockOf<TeamChatAudienceService>
    readonly cards: MockOf<TeamChatCardsService>
    readonly payloadOf: (changeId: string) => BrainChangePayload
}

/** The team chat as a map of lines by client id: posting once per key, folding in place. */
const chatWorld = (): ChatWorld => {
    const lines = new Map<string, ChatCardLine>()
    const audience = mock<TeamChatAudienceService>()
    const cards = mock<TeamChatCardsService>()
    audience.storedCard.mockImplementation((_ws, key) => Promise.resolve(lines.get(key)?.message ?? null))
    audience.foldTeamCard.mockImplementation((_ws, key, message) => {
        const line = lines.get(key)
        if (line === undefined) return Promise.resolve(null)
        lines.set(key, { ...line, message })
        return Promise.resolve(line.id)
    })
    const posted = (roomId: string, key: string, agentMessage: string) => {
        const kept = lines.get(key)
        if (kept !== undefined) return { roomId: kept.roomId, messageId: kept.id }
        const id = `msg-${lines.size + 1}`
        lines.set(key, { id, roomId, message: cardOfText(agentMessage) })
        return { roomId, messageId: id }
    }
    cards.postMessage.mockImplementation((_ws, line) => Promise.resolve(posted(line.roomId ?? "", line.key ?? "", line.agentMessage ?? "")))
    cards.postAsAgent.mockImplementation((_ws, post) =>
        Promise.resolve({
            ...posted("room-founder-direct", post.key ?? "", post.agentMessage ?? ""),
            agentId: post.agent,
        }),
    )
    const payloadOf = (changeId: string): BrainChangePayload =>
        payloadOfMessage(lines.get(brainChangeKeyOf(changeId))?.message ?? NO_CARD)
    return { lines, audience, cards, payloadOf }
}

/** The facts store of the world: the facts by id, proposals filed against the one in force, the flags the card sets. */
const factsStoreOf = (byId: Map<string, FactRecord>) => {
    const store = mock<BrainFactsService>()
    store.get.mockImplementation((_ws, id) => Promise.resolve(byId.get(id) ?? null))
    // The store's key is subject + attribute + instance scope, exactly (W2).
    store.byKey.mockImplementation((_ws, subject, attribute, status, installationId) =>
        Promise.resolve(
            [...byId.values()].filter(
                (fact) =>
                    fact.status === status &&
                    fact.subjectKey === subject &&
                    fact.attribute === attribute &&
                    fact.installationId === installationId,
            ),
        ),
    )
    store.propose.mockImplementation(async (_ws, input) => {
        const subjectKey = factSlugOf(input.subjectLabel)
        const attribute = factSlugOf(input.attributeLabel)
        const scope = input.installationId ?? null
        const [active] = await store.byKey(facts.WS, subjectKey, attribute, "active", scope)
        const fact = proposalOf(`p-${byId.size}`, input.value, {
            subjectKey,
            attribute,
            subjectLabel: input.subjectLabel,
            attributeLabel: input.attributeLabel,
            installationId: scope,
            conflictWith: active?.id ?? null,
            // As the store: a known fact keeps who may read it; a new one is internal (`brain-facts.service.ts` propose).
            scope: input.scope ?? active?.scope ?? "internal",
            modules: [...(input.modules ?? active?.modules ?? [])],
            validFrom: input.validFrom ?? null,
            validTo: input.validTo ?? null,
        })
        byId.set(fact.id, fact)
        return { fact, outcome: active === undefined ? "proposed" : "conflict" }
    })
    store.flagSameMeaning.mockImplementation((_ws, id, sameAs) => {
        const fact = byId.get(id)
        if (fact !== undefined) byId.set(id, { ...fact, conflictWith: sameAs, flags: ["same_meaning"] })
        return Promise.resolve(fact !== undefined)
    })
    store.keepApart.mockImplementation((_ws, id) => {
        const fact = byId.get(id)
        if (fact !== undefined) byId.set(id, { ...fact, conflictWith: null, flags: [] })
        return Promise.resolve(fact !== undefined)
    })
    return store
}

/** The Brain service of the world: deciding a fact moves it to rejected or active in the map. */
const brainOf = (byId: Map<string, FactRecord>) => {
    const brain = mock<BrainService>()
    brain.decideFact.mockImplementation((_userId, decision) => {
        const fact = byId.get(decision.id)
        if (fact === undefined) return Promise.reject(new BrainFactsError({ code: BrainFactsErrorCode.FactNotFound }))
        const decided: FactRecord = { ...fact, status: decision.action === "reject" ? "rejected" : "active" }
        byId.set(fact.id, decided)
        return Promise.resolve(decided)
    })
    return brain
}

/** The whole world one spec runs the card service in: the chat, the stores, the real requests service, the card service. */
export const buildChangeWorld = async (): Promise<ChangeWorld> => {
    const chat = chatWorld()
    const byId = new Map<string, FactRecord>([[ACTIVE.id, ACTIVE]])
    const store = factsStoreOf(byId)
    const clock = new FakeClock("2026-11-11T10:45:00.000Z")
    // The person's line the requests quote: who wrote it and what it says (a spec may change both). It holds every quote of this file.
    const said: ChatSaid = {
        authorId: OWNER,
        body: EM_OI_TU_MAI_PHI_SHIP_VI,
    }
    const teamStore = mock<TeamChatStoreService>()
    teamStore.messagesByIds.mockImplementation((_ws, ids) =>
        Promise.resolve(
            ids[0] === LINE ? [mock<ChatLineRow>({ id: LINE, roomId: ROOM, authorKind: "user", createdAt: SAID_AT, ...said })] : [],
        ),
    )
    const people = mock<WorkspaceMembersReadService>()
    people.namesOf.mockResolvedValue([{ userId: OWNER, displayName: "nivo-owner" }])
    const members = mock<WorkspaceMembersService>()
    members.require.mockImplementation((userId) => Promise.resolve(memberOf(userId, userId === OWNER ? "owner" : "manager")))
    const brain = brainOf(byId)
    const vectors = mock<FactEmbeddingsService>()
    vectors.nearestInForce.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainChangeMessagesService,
            BrainChangeRequestsService,
            { provide: CLOCK, useValue: clock },
            { provide: BrainFactsService, useValue: store },
            { provide: BrainService, useValue: brain },
            { provide: TeamChatAudienceService, useValue: chat.audience },
            { provide: TeamChatCardsService, useValue: chat.cards },
            { provide: TeamChatStoreService, useValue: teamStore },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: WorkspaceMembersReadService, useValue: people },
            { provide: FactEmbeddingsService, useValue: vectors },
        ],
    }).compile()
    await moduleRef.init()
    return {
        ...chat,
        service: moduleRef.get(BrainChangeMessagesService),
        requests: moduleRef.get(BrainChangeRequestsService),
        store,
        brain,
        byId,
        vectors,
        said,
        members,
    }
}

/** The person's chat line a change request quotes: who wrote it and what it says. */
export interface ChatSaid {
    authorId: string
    body: string
}

/** The world one spec runs in: the chat, the stores, the real requests service, the card service. */
export interface ChangeWorld extends ChatWorld {
    /** The card service under test. */
    readonly service: BrainChangeMessagesService
    /** The real change-requests service. */
    readonly requests: BrainChangeRequestsService
    /** The facts store double. */
    readonly store: MockOf<BrainFactsService>
    /** The Brain service double. */
    readonly brain: MockOf<BrainService>
    /** The facts by id. */
    readonly byId: Map<string, FactRecord>
    /** The fact-embeddings double. */
    readonly vectors: MockOf<FactEmbeddingsService>
    /** The chat line the requests quote: who wrote it and what it says (a spec may change both). */
    readonly said: ChatSaid
    /** The workspace members double. */
    readonly members: MockOf<WorkspaceMembersService>
}

/** A change request a Sales agent files from the founder's chat line, with the given changes. */
export const requestOf = (changes: Partial<ReasonedChangeRequest> = {}): ReasonedChangeRequest => ({
    subjectLabel: DELIVERY_GROUP_LABEL_VI,
    attributeLabel: PHI_SHIP_NOI_THANH_VI,
    value: T_30_000_D_VI,
    room: "direct",
    messageId: LINE,
    quote: TU_MAI_PHI_SHIP_NOI_THANH_VI,
    reason: ANH_VUA_NHAN_TU_MAI_PHI_VI,
    proposedBy: "sales",
    agentId: "agent-sales",
    installationId: null,
    ...changes,
})
