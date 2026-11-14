import type { RouteHold } from "@modules/domain/customer-routes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import type { LeadMemoryService } from "@modules/domain/lead-memory"
import { CALL, PERSON, TELEGRAM_ACCOUNT, TURN, WHERE, build, contact, identity } from "@tests/fixtures/builders/channel-send-executor.builder"
import { ChatNodePortsError } from "./errors/chat-node-ports.error"

// E-SMALL item 2 (R79 MXW-3 option A). RULE S-2 (engine words): a customer send may name a ROUTE (the route a record came in on) instead of
// a person; the route's person, channel and account are the address, and from there it is the same send: holds, consent, rights, window,
// ledger. A run that serves no person (a clock round, a team-chat turn) could not address anyone before: `no_recipient`.

type World = Awaited<ReturnType<typeof build>>

/** A run that serves nobody and was woken on no route (a clock round, a team-chat turn). */
const NOBODY: NodeTurn = { ...TURN, conversationId: null, contactId: null }

/** The send of such a run, addressed by the route a record came in on. */
const BY_ROUTE = { routeId: WHERE.routeId, text: "Hello" }

/** The staff hold over the memory route store (as `channel-send-executor.hold.spec.ts` lays it). */
const withHolds = (world: World): Map<string, RouteHold> => {
    const holds = new Map<string, RouteHold>()
    Object.assign(world.routeRows, {
        holdOf: (_workspaceId: string, routeId: string) => Promise.resolve(holds.get(routeId) ?? null),
    })
    return holds
}

const optedOut = { lead: { careOptOut: true } } as unknown as Awaited<ReturnType<LeadMemoryService["snapshot"]>>

describe("ChannelSendExecutorService: a send addressed by a route (rule S-2)", () => {
    it("before: a run that serves nobody, naming no route, has nobody to speak to", async () => {
        const world = await build()
        await expect(world.executor.execute(NOBODY, { text: "Hello" }, CALL)).resolves.toMatchObject({ kind: "refused", id: "no_recipient" })
    })

    it("speaks to the route's person on that very route, as an unprompted message: the opt-out is read, the ledger keeps the line", async () => {
        const world = await build()
        const answered = await world.executor.execute(NOBODY, BY_ROUTE, CALL)
        expect(answered).toMatchObject({
            kind: "message",
            facts: { delivered: true, contactId: PERSON, channel: "telegram", accountId: TELEGRAM_ACCOUNT, routeId: WHERE.routeId },
        })
        expect(world.delivery.deliverToPerson).toHaveBeenCalledWith(
            expect.objectContaining({ routeId: WHERE.routeId, channel: "telegram", accountId: TELEGRAM_ACCOUNT, userId: "555" }),
        )
        expect(world.memory.snapshot).toHaveBeenCalled()
        expect(world.ledger.rows).toEqual([expect.objectContaining({ sendKey: CALL.key, routeId: WHERE.routeId, contactId: PERSON })])
    })

    it("the same consent: a person who opted out of unprompted messages is not written to", async () => {
        const world = await build()
        world.memory.snapshot.mockResolvedValue(optedOut)
        await expect(world.executor.execute(NOBODY, BY_ROUTE, CALL)).resolves.toMatchObject({ kind: "refused", id: "customer_opted_out" })
        expect(world.delivery.deliverToPerson).not.toHaveBeenCalled()
    })

    it("a reply on the run's own woken route is a reply (no opt-out read), whichever way it is addressed", async () => {
        const world = await build()
        world.memory.snapshot.mockResolvedValue(optedOut)
        await expect(world.executor.execute(TURN, BY_ROUTE, CALL)).resolves.toMatchObject({ kind: "message" })
    })

    it("the same hold: a route a member holds refuses `route_held`, in the check and in the send", async () => {
        const world = await build()
        withHolds(world).set(WHERE.routeId, { memberId: "m-staff", at: "2026-11-04T09:00:00.000Z" })
        await expect(world.executor.refusalFor(NOBODY, BY_ROUTE, CALL)).resolves.toMatchObject({ kind: "refused", id: "route_held" })
        expect(world.ledger.rows).toEqual([])
        await expect(world.executor.execute(NOBODY, BY_ROUTE, CALL)).resolves.toMatchObject({ kind: "refused", id: "route_held" })
        expect(world.delivery.deliverToPerson).not.toHaveBeenCalled()
    })

    it("the same rights: the calling agent not attached to the route's account is refused", async () => {
        const world = await build()
        world.access.judgeSend.mockResolvedValue({ kind: "refuse", reason: "not_attached", providers: ["telegram"] })
        await expect(world.executor.execute(NOBODY, BY_ROUTE, CALL)).resolves.toMatchObject({ kind: "refused", id: "channel_no_access" })
    })

    it("an unknown route, or one whose person is erased: `no_recipient`; a person no longer on the route's entrance: `no_channel_identity`", async () => {
        const world = await build()
        await expect(world.executor.execute(NOBODY, { ...BY_ROUTE, routeId: "route-x" }, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: "no_recipient",
            facts: { routeId: "route-x" },
        })
        world.contacts.get.mockResolvedValueOnce(null)
        await expect(world.executor.execute(NOBODY, BY_ROUTE, CALL)).resolves.toMatchObject({ kind: "refused", id: "no_recipient" })
        world.contacts.get.mockResolvedValueOnce(contact([identity({ provider: "zalo", account: "oa-1" })]))
        await expect(world.executor.execute(NOBODY, BY_ROUTE, CALL)).resolves.toMatchObject({ kind: "refused", id: "no_channel_identity" })
        expect(world.delivery.deliverToPerson).not.toHaveBeenCalled()
    })

    it("picks the identity of the route's own entrance when the person is known on several", async () => {
        const world = await build()
        const zalo = identity({ id: "i-2", provider: "zalo", account: "oa-1", value: "777", at: "2026-11-03T10:00:00.000Z" })
        world.contacts.get.mockResolvedValue(contact([identity(), zalo]))
        const { routeId } = await world.routes.ensure("ws-1", { contactId: PERSON, channel: "zalo", accountId: "oa-1" })
        world.access.judgeSend.mockResolvedValue({ kind: "allow", provider: "zalo_oa", connectionId: "oa-1" })
        world.connections.find.mockResolvedValue({ id: "oa-1" } as never)
        await expect(world.executor.execute(NOBODY, { ...BY_ROUTE, routeId }, CALL)).resolves.toMatchObject({
            kind: "message",
            facts: { channel: "zalo", accountId: "oa-1", routeId },
        })
        expect(world.delivery.deliverToPerson).toHaveBeenCalledWith(expect.objectContaining({ routeId, userId: "777" }))
    })

    it("a route is named alone: with a person, a channel or an account beside it the payload is invalid", async () => {
        const world = await build()
        await expect(world.executor.execute(NOBODY, { ...BY_ROUTE, contactId: PERSON }, CALL)).rejects.toBeInstanceOf(ChatNodePortsError)
        await expect(world.executor.refusalFor(NOBODY, { ...BY_ROUTE, channel: "telegram" }, CALL)).resolves.toBeNull()
        expect(world.delivery.deliverToPerson).not.toHaveBeenCalled()
    })
})
