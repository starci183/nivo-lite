import { InboundEventsService } from "@modules/domain/inbound-events"
import { eachInOrder } from "@modules/platform/primitives"
import { persistInboundInputWorkspace } from "../../fixtures/builders/inbound-input.builder"
import { INPUT_EVENT } from "../../fixtures/persistence/inbound-input.sql"
import { INBOX_CLAIM } from "../../fixtures/persistence/inbox-dedupe.sql"
import { CLEAN_API_INBOX } from "../../fixtures/persistence/public-api.sql"
import { CLEAN_USER, CLEAN_WORKSPACE } from "../../fixtures/persistence/proof.sql"
import { InboundInputProofModule } from "../../world/inbound-input-proof.module"
import { useTestWorld } from "../../world/use-test-world"

const world = useTestWorld({ modules: [InboundInputProofModule.register()] })
const first = { workspaceId: world.id(), ownerId: world.id() }
const second = { workspaceId: world.id(), ownerId: world.id() }
const recovery = { workspaceId: world.id(), ownerId: world.id() }

const inputOf = (workspaceId: string, eventId: string) => ({
    workspaceId,
    channel: "telegram",
    kind: "message",
    senderName: "Inbound proof customer",
    senderContact: null,
    body: "Keep this real customer input",
    externalRef: null,
    eventId,
})

const claimOf = (workspaceId: string, kind: string, eventId: string) =>
    world.db.primary.query(INBOX_CLAIM, ["telegram", `${workspaceId}:telegram:${kind}:${eventId}`])

beforeAll(async () => {
    world.cleanup(async () => {
        await eachInOrder([first, second, recovery], async (identity) => {
            await world.db.primary.query(CLEAN_API_INBOX, [identity.workspaceId])
            await world.db.primary.query(CLEAN_WORKSPACE, [identity.workspaceId])
            await world.db.primary.query(CLEAN_USER, [identity.ownerId])
        })
    })
    await eachInOrder([first, second], (identity) => persistInboundInputWorkspace(world.db.primary, identity))
})

describe("workspace-scoped atomic inbound inputs over PostgreSQL", () => {
    it("keeps the same channel event independently in two workspaces", async () => {
        const events = world.resolve(InboundEventsService)
        const eventId = world.key("same-telegram-event")
        const left = await events.recordInput(inputOf(first.workspaceId, eventId))
        const right = await events.recordInput(inputOf(second.workspaceId, eventId))

        expect(left.duplicate).toBe(false)
        expect(right.duplicate).toBe(false)
        expect(left.inboundEventId).not.toBe(right.inboundEventId)
        await expect(events.find(first.workspaceId, left.inboundEventId)).resolves.toMatchObject({
            id: left.inboundEventId,
            event_id: eventId,
        })
        await expect(events.find(second.workspaceId, right.inboundEventId)).resolves.toMatchObject({
            id: right.inboundEventId,
            event_id: eventId,
        })
        expect(await claimOf(first.workspaceId, "message", eventId)).toHaveLength(1)
        expect(await claimOf(second.workspaceId, "message", eventId)).toHaveLength(1)
    })

    it("claims different domain kinds separately and normalizes surrounding event whitespace", async () => {
        const events = world.resolve(InboundEventsService)
        const eventId = world.key("same-id-different-kind")
        const input = inputOf(first.workspaceId, eventId)
        const message = await events.recordInput(input)
        const lead = await events.recordInput({ ...input, kind: "lead" })

        expect(message.duplicate).toBe(false)
        expect(lead.duplicate).toBe(false)
        expect(message.inboundEventId).not.toBe(lead.inboundEventId)
        await expect(events.recordInput({ ...input, eventId: ` ${eventId} ` })).resolves.toEqual({
            duplicate: true,
            inboundEventId: message.inboundEventId,
        })
        expect(await claimOf(first.workspaceId, "message", eventId)).toHaveLength(1)
        expect(await claimOf(first.workspaceId, "lead", eventId)).toHaveLength(1)
    })
})

describe("inbound input recovery over PostgreSQL", () => {
    it("rolls the claim back with a failed insert and records the same input when retried", async () => {
        const events = world.resolve(InboundEventsService)
        const eventId = world.key("foreign-key-retry")
        const input = inputOf(recovery.workspaceId, eventId)
        const key = `telegram:message:${eventId}`

        await expect(events.recordInput(input)).rejects.toMatchObject({ code: "23503" })
        expect(await claimOf(recovery.workspaceId, "message", eventId)).toHaveLength(0)
        expect(await world.db.primary.query(INPUT_EVENT, [recovery.workspaceId, key])).toEqual([])
        await persistInboundInputWorkspace(world.db.primary, recovery)
        const recorded = await events.recordInput(input)
        expect(recorded.duplicate).toBe(false)
        expect(await world.db.primary.query(INPUT_EVENT, [recovery.workspaceId, key])).toEqual([
            { id: recorded.inboundEventId, event_id: eventId },
        ])
        await expect(events.recordInput(input)).resolves.toEqual({ ...recorded, duplicate: true })
    })

    it("returns the committed event id to every concurrent retry of one input", async () => {
        const events = world.resolve(InboundEventsService)
        const eventId = world.key("concurrent-retry")
        const input = inputOf(first.workspaceId, eventId)
        const results = await Promise.all(Array.from({ length: 12 }, () => events.recordInput(input)))

        expect(results.filter((result) => !result.duplicate)).toHaveLength(1)
        expect(new Set(results.map((result) => result.inboundEventId)).size).toBe(1)
        expect(results.every((result) => result.inboundEventId !== "")).toBe(true)
        expect(
            await world.db.primary.query(INPUT_EVENT, [first.workspaceId, `telegram:message:${eventId}`]),
        ).toHaveLength(1)
        expect(await claimOf(first.workspaceId, "message", eventId)).toHaveLength(1)
    })
})
