import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"
import { AgentWakeService, type AgentWake } from "@modules/domain/agent-work"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { ContactsService } from "@modules/domain/contacts"
import { CustomerMessagesService, CustomerRoutesService } from "@modules/domain/customer-routes"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { switchRowOf } from "@tests/fixtures/builders/provider-triggers.builder"
import { ProviderTriggerStoreService } from "./provider-trigger-store.service"
import type { DeliverInput, ProviderTriggerReceivers, TriggerTaker } from "./provider-triggers.contracts"
import { PROVIDER_TRIGGER_RECEIVERS } from "./provider-triggers.decorators"
import { ProviderTriggersService } from "./provider-triggers.service"
import type { TriggerDeclaration } from "./trigger-declaration.contracts"
import { triggerDeclarations } from "./trigger-declarations.registry"

type ConnectionRecord = NonNullable<Awaited<ReturnType<ConnectionBindingsReadService["recordOf"]>>>

const NOW = new Date("2026-11-14T03:00:00Z")

/** A customer line of a channel: about a person, keyed by their route. */
const LINE_RAW = z.object({ userId: z.string(), messageId: z.string(), text: z.string() })
const LINE_DATA = z.object({ messageKey: z.string(), text: z.string() })
const ZALO_LINE: TriggerDeclaration<z.infer<typeof LINE_RAW>, z.infer<typeof LINE_DATA>> = {
    provider: PROVIDER.zaloOa,
    name: "message.received",
    verb: TRIGGER.zaloMessageReceived,
    via: "webhook",
    raw: LINE_RAW,
    data: LINE_DATA,
    translate: (raw) => ({
        id: raw.messageId,
        subject: { channel: "zalo", id: raw.userId },
        data: { messageKey: raw.messageId, text: raw.text },
    }),
    key: { by: "subject" },
    // The source's pure reading of its event as a person's message (R26).
    line: (data) => ({ key: data.messageKey, text: data.text, at: null }),
    // A chat line settles a few seconds, capped: the SOURCE's settle time (the coordinator's final rule).
    settle: { windowMs: 6000, maxWaitMs: 20_000 },
}

/** A bank credit: about no person, keyed by its transaction. */
const CREDIT_RAW = z.object({ transactionId: z.string(), direction: z.string() })
const CREDIT_DATA = z.object({ transactionId: z.string(), direction: z.string() })
const SEPAY_CREDIT: TriggerDeclaration<z.infer<typeof CREDIT_RAW>, z.infer<typeof CREDIT_DATA>> = {
    provider: PROVIDER.sepay,
    name: "transaction.received",
    verb: TRIGGER.paymentCreditReceived,
    via: "webhook",
    raw: CREDIT_RAW,
    data: CREDIT_DATA,
    translate: (raw) => ({ id: raw.transactionId, data: raw }),
    key: { by: "data", member: "transactionId" },
}

/** The clock: no account, no key (every tick its own run). */
const CLOCK_RAW = z.object({ slotMs: z.number() })
const CLOCK_TICK: TriggerDeclaration<z.infer<typeof CLOCK_RAW>, z.infer<typeof CLOCK_RAW>> = {
    provider: PROVIDER.nivo,
    name: "clock.tick",
    verb: TRIGGER.clockTick,
    via: "clock",
    raw: CLOCK_RAW,
    data: CLOCK_RAW,
    translate: (raw) => ({ id: `reg-1:${raw.slotMs}`, data: raw }),
    key: { by: "none" },
}

triggerDeclarations.register(ZALO_LINE, SEPAY_CREDIT, CLOCK_TICK)

/** Who takes what: per agent, the taker its registration answers (none when absent). */
type Takers = Readonly<Record<string, TriggerTaker | ((scope: Readonly<Record<string, unknown>>) => TriggerTaker | null)>>

const build = async (attached: ReadonlyArray<string>, takers: Takers) => {
    const store = mock<ProviderTriggerStoreService>()
    store.find.mockResolvedValue(switchRowOf({ enabledAt: new Date("2026-11-14T00:00:00Z") }))
    const connections = mock<ConnectionBindingsReadService>()
    connections.recordOf.mockImplementation((workspaceId, id) =>
        Promise.resolve(
            workspaceId === "ws-1"
                ? mock<ConnectionRecord>({ id, workspaceId, provider: id === "conn-bank" ? "sepay" : "zalo_oa", status: "connected" })
                : null,
        ),
    )
    const receivers = mock<ProviderTriggerReceivers>()
    receivers.attachedTo.mockResolvedValue(attached)
    receivers.takerOf.mockImplementation((_ws, agentId, _verb, scope) => {
        const taker = takers[agentId]
        if (taker === undefined) return Promise.resolve(null)
        return Promise.resolve(typeof taker === "function" ? taker(scope) : taker)
    })
    const contacts = mock<ContactsService>()
    contacts.meetChannel.mockImplementation((_ws, person) => Promise.resolve(`contact-of-${person.userId}`))
    const routes = mock<CustomerRoutesService>()
    routes.ensure.mockImplementation((_ws, request) => Promise.resolve({ routeId: `route-of-${request.contactId}`, created: false }))
    // The staff holds (R43/R45): the routes a member of the shop holds, by route id; none unless a case holds one.
    const holds = new Map<string, string>()
    routes.holdOf.mockImplementation((_ws, routeId) => {
        const memberId = holds.get(routeId)
        return Promise.resolve(memberId === undefined ? null : { memberId, at: NOW.toISOString() })
    })
    // The wake door's insert-or-nothing on (agent, source, event key), as the table's unique key makes it.
    const written = new Map<string, AgentWake>()
    const wakes = mock<AgentWakeService>()
    wakes.write.mockImplementation((_tx, wake) => {
        const key = `${wake.agentId}|${wake.source}|${wake.eventKey}`
        if (written.has(key)) return Promise.resolve(null)
        written.set(key, wake)
        return Promise.resolve(`wake-${written.size}`)
    })
    const lines = mock<CustomerMessagesService>()
    lines.hear.mockResolvedValue({ id: "line-1", written: true })
    const manager = mockEntityManager()
    fakeTransaction(manager)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProviderTriggersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: ProviderTriggerStoreService, useValue: store },
            { provide: ConnectionBindingsReadService, useValue: connections },
            { provide: InboundEventsService, useValue: mock<InboundEventsService>() },
            { provide: PROVIDER_TRIGGER_RECEIVERS, useValue: receivers },
            { provide: ContactsService, useValue: contacts },
            { provide: CustomerRoutesService, useValue: routes },
            { provide: AgentWakeService, useValue: wakes },
            { provide: CustomerMessagesService, useValue: lines },
        ],
    }).compile()
    return { service: moduleRef.get(ProviderTriggersService), manager, wakes: [...written.values()], written, contacts, routes, receivers, lines, store, holds }
}

const FRONT_DESK: TriggerTaker = { workflowId: "wf-front", ownKey: null }

const lineOf = (messageId: string, text: string, userId = "zalo-user-1"): DeliverInput["events"][number] => {
    const raw = { userId, messageId, text }
    const event = ZALO_LINE.translate(raw, { connectionId: "conn-zalo" })
    if (event === null) throw new Error("the test line does not translate")
    return { event, raw: { type: "zalo_oa.message", id: `row-${messageId}` } }
}

const zaloInput = (events: DeliverInput["events"]): DeliverInput => ({
    workspaceId: "ws-1",
    declaration: ZALO_LINE,
    connectionId: "conn-zalo",
    agentId: null,
    events,
})

describe("ProviderTriggersService.deliver: the one delivery function", () => {
    it("meets the person, ensures the route and writes ONE wake per event, keyed by the route, ids only, with the source's settle time", async () => {
        const world = await build(["front"], { front: FRONT_DESK })
        const result = await world.service.deliver(zaloInput([lineOf("m-1", "xin chao")]), world.manager)

        expect(result).toEqual({
            status: "delivered",
            events: 1,
            dropped: 0,
            woken: [{ agentId: "front", workflowId: "wf-front", eventId: "m-1", wakeId: "wake-1" }],
            repeats: 0,
            untaken: 0,
            held: 0,
        })
        expect(world.contacts.meetChannel).toHaveBeenCalledWith("ws-1", {
            channel: "zalo",
            account: "conn-zalo",
            userId: "zalo-user-1",
            name: null,
        })
        const [wake] = [...world.written.values()]
        expect(wake).toMatchObject({
            agentId: "front",
            source: "trigger",
            eventKey: `${TRIGGER.zaloMessageReceived}:conn-zalo:m-1`,
            scopeKey: "key:routeId=route-of-contact-of-zalo-user-1",
            settle: { windowMs: 6000, maxWaitMs: 20_000 },
        })
        // Ids only: the words stay in the raw row the run translates again.
        expect(wake?.context).toEqual({
            verb: TRIGGER.zaloMessageReceived,
            eventId: "m-1",
            declaration: "zalo_oa:message.received",
            workflowId: "wf-front",
            keyPath: "routeId",
            connectionId: "conn-zalo",
            contactId: "contact-of-zalo-user-1",
            conversationId: "route-of-contact-of-zalo-user-1",
            rawType: "zalo_oa.message",
            rawRowId: "row-m-1",
        })
        expect(JSON.stringify(wake?.context)).not.toContain("xin chao")
    })

    it("the same event delivered twice writes one wake: the second is a repeat with the same once-key", async () => {
        const world = await build(["front"], { front: FRONT_DESK })
        await world.service.deliver(zaloInput([lineOf("m-1", "xin chao")]), world.manager)
        const again = await world.service.deliver(zaloInput([lineOf("m-1", "xin chao")]), world.manager)

        expect(again).toMatchObject({ status: "delivered", woken: [], repeats: 1 })
        expect(world.written.size).toBe(1)
    })

    it("three lines of one person share ONE lock scope (their run's key), so the drain starts one run and queues the others", async () => {
        const world = await build(["front"], { front: FRONT_DESK })
        await world.service.deliver(
            zaloInput([lineOf("m-1", "cho em hoi"), lineOf("m-2", "gia ao nay"), lineOf("m-3", "bao nhieu a")]),
            world.manager,
        )
        const scopes = [...world.written.values()].map((wake) => wake.scopeKey)
        expect(scopes).toEqual([scopes[0], scopes[0], scopes[0]])
        expect(world.written.size).toBe(3)
        // Another person on the same account is another key.
        await world.service.deliver(zaloInput([lineOf("m-9", "alo", "zalo-user-2")]), world.manager)
        expect([...world.written.values()].at(-1)?.scopeKey).not.toBe(scopes[0])
    })

    it("an event of an account whose agent is not attached wakes nothing: it is counted untaken", async () => {
        const world = await build([], { front: FRONT_DESK })
        const result = await world.service.deliver(zaloInput([lineOf("m-1", "xin chao")]), world.manager)

        expect(result).toMatchObject({ status: "delivered", events: 1, woken: [], untaken: 1 })
        expect(world.written.size).toBe(0)
        expect(world.receivers.takerOf).not.toHaveBeenCalled()
    })

    it("the account's switch counts each ACCEPTED event once (last fired, N times): not per registration, not a repeat", async () => {
        const world = await build(["books", "refunds"], { books: { workflowId: "wf-in", ownKey: null }, refunds: { workflowId: "wf-out", ownKey: null } })
        const credit = (transactionId: string) => {
            const event = SEPAY_CREDIT.translate({ transactionId, direction: "in" }, { connectionId: "conn-bank" })
            if (event === null) throw new Error("the test credit does not translate")
            return { event, raw: { type: "sepay.transaction", id: `row-${transactionId}` } }
        }
        const input = (ids: ReadonlyArray<string>): DeliverInput => ({
            workspaceId: "ws-1",
            declaration: SEPAY_CREDIT,
            connectionId: "conn-bank",
            agentId: null,
            events: ids.map((id) => credit(id)),
        })

        await world.service.deliver(input(["tx-1", "tx-2"]), world.manager)
        await world.service.deliver(input(["tx-1"]), world.manager)

        // Two agents took each credit, yet the switch counted two events; the second delivery of tx-1 was a repeat: no firing.
        expect(world.store.markFired).toHaveBeenCalledTimes(1)
        expect(world.store.markFired).toHaveBeenCalledWith(world.manager, expect.any(String), NOW, 2)
    })

    it("R26: a person's message is kept on its route ONCE per event, before MATCH, taken or not; twice delivered = the same key twice", async () => {
        const world = await build([], {})

        await world.service.deliver(zaloInput([lineOf("m-1", "xin chao")]), world.manager)
        await world.service.deliver(zaloInput([lineOf("m-1", "xin chao")]), world.manager)

        expect(world.lines.hear).toHaveBeenCalledTimes(2)
        expect(world.lines.hear.mock.calls.map(([, line]) => line.key)).toEqual(["m-1", "m-1"])
        expect(world.lines.hear.mock.calls[0]?.[1]).toMatchObject({
            workspaceId: "ws-1",
            routeId: "route-of-contact-of-zalo-user-1",
            contactId: "contact-of-zalo-user-1",
            channel: "zalo",
            accountId: "conn-zalo",
            text: "xin chao",
            eventId: "m-1",
        })
    })

    it("R45: a line of a person whose route a member holds is KEPT (the person's line) but correlated to nothing: no run, no wait", async () => {
        const world = await build(["chatbot", "sales"], { chatbot: FRONT_DESK })
        const waitsOn = jest.fn(() => Promise.resolve(true))
        Object.assign(world.receivers, { waitsOn })
        world.holds.set("route-of-contact-of-zalo-user-1", "member-7")

        const result = await world.service.deliver(zaloInput([lineOf("m-1", "con hang khong")]), world.manager)

        expect(result).toEqual({ status: "delivered", events: 1, dropped: 0, woken: [], repeats: 0, untaken: 0, held: 1 })
        expect(world.lines.hear).toHaveBeenCalledTimes(1)
        expect(world.written.size).toBe(0)
        expect(world.receivers.takerOf).not.toHaveBeenCalled()
        expect(waitsOn).not.toHaveBeenCalled()
    })

    it("R45: another person's line on the same account, and an event with no person (a credit), flow as usual during the hold", async () => {
        const world = await build(["chatbot", "books"], { chatbot: FRONT_DESK, books: { workflowId: "wf-books", ownKey: null } })
        world.holds.set("route-of-contact-of-zalo-user-1", "member-7")

        const other = await world.service.deliver(zaloInput([lineOf("m-9", "alo", "zalo-user-2")]), world.manager)
        expect(other).toMatchObject({ held: 0 })
        expect(other.status === "delivered" ? other.woken : []).toContainEqual(
            expect.objectContaining({ agentId: "chatbot", workflowId: "wf-front", eventId: "m-9" }),
        )

        const credit = SEPAY_CREDIT.translate({ transactionId: "tx-1", direction: "in" }, { connectionId: "conn-bank" })
        if (credit === null) throw new Error("the test credit does not translate")
        const paid = await world.service.deliver(
            {
                workspaceId: "ws-1",
                declaration: SEPAY_CREDIT,
                connectionId: "conn-bank",
                agentId: null,
                events: [{ event: credit, raw: { type: "sepay.transaction", id: "row-tx-1" }, routeId: "route-of-contact-of-zalo-user-1" }],
            },
            world.manager,
        )
        expect(paid).toMatchObject({ held: 0 })
        expect(paid.status === "delivered" ? paid.woken : []).toContainEqual(expect.objectContaining({ agentId: "books", eventId: "tx-1" }))
    })

    it("an attached agent no registration of which takes the event still hears it when a `wait` of its workflows lists the verb", async () => {
        const world = await build(["chatbot", "sales"], { chatbot: FRONT_DESK })
        const waitsOn = jest.fn((_ws: string, agentId: string) => Promise.resolve(agentId === "sales"))
        Object.assign(world.receivers, { waitsOn })

        const result = await world.service.deliver(zaloInput([lineOf("m-1", "con hang khong")]), world.manager)

        // The front desk's wake (its registration took it) and the sales agent's wait-only wake (its parked sale run may take it first).
        expect(result).toMatchObject({ status: "delivered", events: 1, woken: [{ agentId: "chatbot", workflowId: "wf-front" }], untaken: 0 })
        const [front, sales] = [...world.written.values()]
        expect(front?.context).toMatchObject({ workflowId: "wf-front" })
        expect(front?.context).not.toHaveProperty("waitOnly")
        expect(sales).toMatchObject({ agentId: "sales", scopeKey: front?.scopeKey, eventKey: front?.eventKey })
        expect(sales?.context).toMatchObject({ waitOnly: "true" })
        expect(sales?.context).not.toHaveProperty("workflowId")
    })

    it("an event NO registration of any attached agent takes marks its wait-only wakes `unclaimed`; one a registration took does not", async () => {
        const world = await build(["chatbot", "sales"], {})
        const waitsOn = jest.fn((_ws: string, agentId: string) => Promise.resolve(agentId === "sales"))
        Object.assign(world.receivers, { waitsOn })

        const result = await world.service.deliver(zaloInput([lineOf("m-2", "con hang khong")]), world.manager)

        // Nobody's registration took it: the sales agent's wait-only wake is still written (a parked run may take it), marked unclaimed.
        expect(result).toMatchObject({ status: "delivered", events: 1, woken: [] })
        const [sales] = [...world.written.values()]
        expect(sales).toMatchObject({ agentId: "sales" })
        expect(sales?.context).toMatchObject({ waitOnly: "true", unclaimed: "true" })

        const taken = await build(["chatbot", "sales"], { chatbot: FRONT_DESK })
        Object.assign(taken.receivers, { waitsOn })
        await taken.service.deliver(zaloInput([lineOf("m-3", "con hang khong")]), taken.manager)
        const listener = [...taken.written.values()].find((wake) => wake.agentId === "sales")
        expect(listener?.context).toMatchObject({ waitOnly: "true" })
        expect(listener?.context).not.toHaveProperty("unclaimed")
    })

    it("two registrations on one trigger with disjoint `where` each get their own events (MATCH is the registration's)", async () => {
        const byDirection =
            (direction: string, workflowId: string) =>
            (scope: Readonly<Record<string, unknown>>): TriggerTaker | null => {
                const data: unknown = scope.data
                const value = typeof data === "object" && data !== null ? Reflect.get(data, "direction") : undefined
                return value === direction ? { workflowId, ownKey: null } : null
            }
        const world = await build(["books", "refunds"], { books: byDirection("in", "wf-in"), refunds: byDirection("out", "wf-out") })
        const credit = (transactionId: string, direction: string) => {
            const event = SEPAY_CREDIT.translate({ transactionId, direction }, { connectionId: "conn-bank" })
            if (event === null) throw new Error("the test credit does not translate")
            return { event, raw: { type: "sepay.transaction", id: `row-${transactionId}` } }
        }
        const result = await world.service.deliver(
            { workspaceId: "ws-1", declaration: SEPAY_CREDIT, connectionId: "conn-bank", agentId: null, events: [credit("tx-1", "in"), credit("tx-2", "out")] },
            world.manager,
        )

        expect(result).toMatchObject({
            woken: [
                { agentId: "books", workflowId: "wf-in", eventId: "tx-1" },
                { agentId: "refunds", workflowId: "wf-out", eventId: "tx-2" },
            ],
            untaken: 0,
        })
        expect([...world.written.values()].map((wake) => wake.scopeKey)).toEqual([
            "key:data.transactionId=tx-1",
            "key:data.transactionId=tx-2",
        ])
    })

    it("a SePay credit and a clock tick travel the same function: one wake each, the tick keyless and aimed at its agent", async () => {
        const world = await build(["books"], { books: { workflowId: "wf-books", ownKey: null }, agent: { workflowId: "wf-daily", ownKey: null } })
        const credit = SEPAY_CREDIT.translate({ transactionId: "tx-7", direction: "in" }, { connectionId: "conn-bank" })
        const tick = CLOCK_TICK.translate({ slotMs: 1_763_092_800_000 }, { connectionId: null })
        if (credit === null || tick === null) throw new Error("the test events do not translate")

        await world.service.deliver(
            { workspaceId: "ws-1", declaration: SEPAY_CREDIT, connectionId: "conn-bank", agentId: null, events: [{ event: credit, raw: { type: "sepay.transaction", id: "row-7" } }] },
            world.manager,
        )
        const ticked = await world.service.deliver(
            { workspaceId: "ws-1", declaration: CLOCK_TICK, connectionId: null, agentId: "agent", events: [{ event: tick }] },
            world.manager,
        )

        expect(ticked).toMatchObject({ status: "delivered", woken: [{ agentId: "agent", workflowId: "wf-daily" }] })
        const [paid, daily] = [...world.written.values()]
        expect(paid).toMatchObject({ source: "trigger", scopeKey: "key:data.transactionId=tx-7" })
        expect(daily).toMatchObject({
            source: "trigger",
            scopeKey: "agent",
            eventKey: `${TRIGGER.clockTick}:agent:reg-1:1763092800000`,
        })
        // A source with no raw row carries its data on the wake (ids and counts only).
        expect(daily?.context.dataJson).toBe(JSON.stringify({ slotMs: 1_763_092_800_000 }))
        expect(world.contacts.meetChannel).not.toHaveBeenCalled()
    })

    it("a registration's own key wins over the declaration's", async () => {
        const world = await build(["front"], { front: { workflowId: "wf-front", ownKey: "contactId" } })
        await world.service.deliver(zaloInput([lineOf("m-1", "xin chao")]), world.manager)

        expect([...world.written.values()][0]?.scopeKey).toBe("key:contactId=contact-of-zalo-user-1")
    })

    it("drops an event whose data its declaration's schema refuses, and refuses a declaration that is not the registered one", async () => {
        const world = await build(["front"], { front: FRONT_DESK })
        const bad = { event: { id: "m-x", subject: { channel: "zalo", id: "u" }, data: { text: 3 } } }
        await expect(world.service.deliver(zaloInput([bad]), world.manager)).resolves.toMatchObject({ events: 0, dropped: 1 })
        await expect(world.service.deliver({ ...zaloInput([]), declaration: { ...ZALO_LINE } }, world.manager)).rejects.toThrow()
    })

    it("a PINNED workflow call is matched among the pinned workflow's registrations only, carries its params as `data` and its provenance", async () => {
        const CALL_RAW = z.object({ key: z.string(), params: z.record(z.string(), z.unknown()) })
        const CALL_DATA = z.record(z.string(), z.unknown())
        const CALL: TriggerDeclaration<z.infer<typeof CALL_RAW>, z.infer<typeof CALL_DATA>> = {
            provider: PROVIDER.nivo,
            name: "deliver-spec.workflow.called",
            verb: TRIGGER.workflowCalled,
            via: "internal",
            raw: CALL_RAW,
            data: CALL_DATA,
            translate: (raw) => ({ id: raw.key, data: { ...raw.params } }),
            key: { by: "contact" },
        }
        triggerDeclarations.register(CALL)
        const world = await build([], { sales: { workflowId: "wf-consult", ownKey: null } })
        const event = CALL.translate({ key: "call-1", params: { orderId: "o-1" } }, { connectionId: null })
        if (event === null) throw new Error("the test call does not translate")

        const result = await world.service.deliver(
            {
                workspaceId: "ws-1",
                declaration: CALL,
                connectionId: null,
                agentId: "sales",
                events: [{ event, pin: { workflow: "consult", version: "latest" }, caller: { agentId: "chatbot", runId: "run-caller" }, contactId: "c-1" }],
            },
            world.manager,
        )

        expect(result).toMatchObject({ status: "delivered", woken: [{ agentId: "sales", workflowId: "wf-consult", wakeId: "wake-1" }] })
        // MATCH asked only the pinned workflow (by key), never every registration of the verb.
        expect(world.receivers.takerOf).toHaveBeenCalledWith("ws-1", "sales", TRIGGER.workflowCalled, expect.anything(), null, "consult")
        const [wake] = [...world.written.values()]
        expect(wake?.context).toMatchObject({ authorAgentId: "chatbot", contactId: "c-1" })
        expect(JSON.parse(String(wake?.context.tagContext))).toEqual({
            workflowCall: { workflow: "consult", version: "latest" },
            params: { orderId: "o-1" },
            caller: { runId: "run-caller" },
        })
    })
})
