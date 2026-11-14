import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ApiKeyOwnerService } from "@modules/domain/api-keys"
import { EventsService } from "@modules/domain/events"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PublicApiErrorCode } from "./errors/public-api.error"
import type { MessageRequestBody } from "./public-api.contracts"
import { PublicApiLogEvent } from "./public-api.log-events"
import { MESSAGE_AUTO_SEND_WINDOW_MS } from "./public-api.policy"
import { PublicConversationsService } from "./public-conversations.service"
import type { PublicConversationRef } from "./public-conversations.service"
import { PublicMessageFulfillmentService } from "./public-message-fulfillment.service"
import { PublicMessageHoldsService } from "./public-message-holds.service"

const body: MessageRequestBody = {
    conversationId: "conversation-1",
    text: "Exact caller text\nwith its original spacing.  ",
    requireApproval: false,
    source: "api:n8n",
}
const NOW = new Date("2026-10-25T12:00:00.000Z")
const RECENT = new Date("2026-10-25T11:00:00.000Z")
const ROUTE: PublicConversationRef = {
    id: "conversation-1",
    contactId: "contact-1",
    channel: "zalo",
    accountId: "conn-1",
}
const KEY = "key-1"

/** A manager for a request whose route read answers the given conversation, or none. */
const managerWith = (conversation: PublicConversationRef | undefined) => ({ tx: mockEntityManager(), conversation })

/** Who owns what: the agent the key is scoped to (null: none or gone), the agent that answers the route's entrance, the installed front door. */
interface Owners {
    readonly scoped?: string | null
    readonly front?: string | null
    readonly installed?: string | null
}

const build = async (conversation: PublicConversationRef | undefined, owned: Owners = {}) => {
    const events = mock<EventsService>({ record: jest.fn().mockResolvedValue(undefined) })
    const logger = mock<Logger>()
    const chats = mock<PublicConversationsService>()
    chats.find.mockResolvedValue(conversation)
    const holds = mock<PublicMessageHoldsService>({ report: jest.fn().mockResolvedValue(undefined) })
    const owners = mock<ApiKeyOwnerService>()
    owners.scopedAgentOf.mockResolvedValue(owned.scoped === undefined ? "agent-1" : owned.scoped)
    owners.agentOfKey.mockResolvedValue(owned.installed === undefined ? null : owned.installed)
    const bindings = mock<AgentBindingsService>()
    bindings.owningAgentOf.mockResolvedValue(owned.front === undefined ? null : owned.front)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicMessageFulfillmentService,
            { provide: ApiKeyOwnerService, useValue: owners },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: EventsService, useValue: events },
            { provide: PublicConversationsService, useValue: chats },
            { provide: PublicMessageHoldsService, useValue: holds },
            { provide: CLOCK, useValue: new FakeClock(NOW.toISOString()) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(PublicMessageFulfillmentService), events, logger, chats, holds, owners, bindings }
}

describe("PublicMessageFulfillmentService", () => {
    it("answers the send owed to the person of the route: the exact text, the key's agent as sender, the request key as the send key", async () => {
        const { tx, conversation } = managerWith(ROUTE)
        const { service, events, logger, chats } = await build(conversation)

        const pending = await service.fulfill("workspace-1", "request-1", body, RECENT, KEY, tx)

        expect(chats.find).toHaveBeenCalledWith("workspace-1", "conversation-1")
        expect(pending).toEqual({
            workspaceId: "workspace-1",
            sendKey: "api.message:request-1",
            routeId: "conversation-1",
            contactId: "contact-1",
            agentId: "agent-1",
            channel: "zalo",
            accountId: "conn-1",
            text: body.text,
        })
        expect(events.record).toHaveBeenCalledWith(
            {
                workspaceId: "workspace-1",
                kind: "api.message",
                actor: "api:n8n",
                summary: "Message accepted through the API",
                evidence: body.text,
            },
            tx,
        )
        expect(logger.info).not.toHaveBeenCalled()
    })

    it("sends as the route's front door when the key's agent is gone, and as the installed front door only when neither exists", async () => {
        const { tx, conversation } = managerWith(ROUTE)
        const byRoute = await build(conversation, { scoped: null, front: "agent-front" })
        expect((await byRoute.service.fulfill("workspace-1", "request-1", body, RECENT, KEY, tx))?.agentId).toBe(
            "agent-front",
        )
        expect(byRoute.bindings.owningAgentOf).toHaveBeenCalledWith("workspace-1", "conn-1")

        const byInstall = await build(conversation, { scoped: null, front: null, installed: "agent-installed" })
        expect((await byInstall.service.fulfill("workspace-1", "request-1", body, RECENT, KEY, tx))?.agentId).toBe(
            "agent-installed",
        )
    })

    it("keeps the owner lookup's own refusal when neither the key's agent nor a front door exists", async () => {
        const { tx, conversation } = managerWith(ROUTE)
        const { service, owners, events } = await build(conversation, { scoped: null, front: null })
        const refusal = new Error("key needs an agent")
        owners.agentOfKey.mockRejectedValue(refusal)

        await expect(service.fulfill("workspace-1", "request-1", body, RECENT, KEY, tx)).rejects.toBe(refusal)
        expect(events.record).not.toHaveBeenCalled()
    })

    it("keeps the legacy identity as the send key without duplicating evidence already recorded at admission", async () => {
        const { tx, conversation } = managerWith(ROUTE)
        const { service, events } = await build(conversation, { scoped: null, front: "agent-front" })

        const pending = await service.fulfill("workspace-1", "request-1", body, RECENT, null, tx, {
            dedupeKey: "legacy-message",
            recordEvidence: false,
        })

        expect(pending?.sendKey).toBe("legacy-message")
        expect(events.record).not.toHaveBeenCalled()
    })
})

describe("PublicMessageFulfillmentService held messages", () => {
    it("never sends a message the caller asked to approve: the hold is recorded and reported to the founder with its text", async () => {
        const { tx, conversation } = managerWith(ROUTE)
        const { service, events, holds } = await build(conversation)

        const pending = await service.fulfill(
            "workspace-1",
            "request-1",
            { ...body, requireApproval: true },
            RECENT,
            KEY,
            tx,
        )

        expect(pending).toBeNull()
        expect(events.record).toHaveBeenCalledWith(
            expect.objectContaining({ kind: "api.message.held", actor: "api:n8n", evidence: body.text }),
            tx,
        )
        expect(holds.report).toHaveBeenCalledWith({
            workspaceId: "workspace-1",
            agentId: "agent-1",
            conversationId: "conversation-1",
            requestId: "request-1",
            text: body.text,
            reason: "approval_asked",
        })
    })

    it("still lets a message admitted exactly one window ago go out", async () => {
        const { tx, conversation } = managerWith(ROUTE)
        const { service, logger, holds } = await build(conversation)
        const admittedAt = new Date(NOW.getTime() - MESSAGE_AUTO_SEND_WINDOW_MS)

        expect(await service.fulfill("workspace-1", "request-1", body, admittedAt, KEY, tx)).not.toBeNull()
        expect(logger.info).not.toHaveBeenCalled()
        expect(holds.report).not.toHaveBeenCalled()
    })

    it("holds an older message and logs it without the content", async () => {
        const { tx, conversation } = managerWith(ROUTE)
        const { service, events, logger, holds } = await build(conversation)
        const admittedAt = new Date(NOW.getTime() - MESSAGE_AUTO_SEND_WINDOW_MS - 1)

        expect(await service.fulfill("workspace-1", "request-1", body, admittedAt, KEY, tx)).toBeNull()

        expect(logger.info).toHaveBeenCalledWith(PublicApiLogEvent.StaleMessageHeld, {
            workspaceId: "workspace-1",
            requestId: "request-1",
            admittedAt: "2026-10-24T11:59:59.999Z",
        })
        expect(events.record).toHaveBeenCalledTimes(1)
        expect(holds.report).toHaveBeenCalledWith(expect.objectContaining({ requestId: "request-1", reason: "stale" }))
    })

    it("holds a pre-ledger delivery, whose admission time is unknown, even when the caller asked for no approval", async () => {
        const { tx, conversation } = managerWith(ROUTE)
        const { service, logger } = await build(conversation, { front: "agent-front" })

        expect(await service.fulfill("workspace-1", "legacy-1", body, null, null, tx, { dedupeKey: "legacy-1", recordEvidence: false })).toBeNull()

        expect(logger.info).toHaveBeenCalledWith(PublicApiLogEvent.StaleMessageHeld, {
            workspaceId: "workspace-1",
            requestId: "legacy-1",
            admittedAt: null,
        })
    })
})

describe("PublicMessageFulfillmentService refusals", () => {
    it("refuses an id no route of the request workspace holds before any evidence", async () => {
        const { tx, conversation } = managerWith(undefined)
        const { service, events } = await build(conversation)

        await expect(service.fulfill("workspace-1", "request-1", body, RECENT, KEY, tx)).rejects.toMatchObject({
            code: PublicApiErrorCode.ConversationNotFound,
        })

        expect(events.record).not.toHaveBeenCalled()
    })
})
