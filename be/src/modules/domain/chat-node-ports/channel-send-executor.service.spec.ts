import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ChannelsError, ChannelsErrorCode, ZALO_FREE_WINDOW_MS } from "@modules/domain/channels"
import { ChatNodePortsErrorCode } from "./errors/chat-node-ports.error"
import {
    NOW,
    TURN,
    PERSON,
    TELEGRAM_ACCOUNT,
    WHERE,
    build,
    contact,
    identity,
    SEND,
    CALL,
} from "@tests/fixtures/builders/channel-send-executor.builder"

type World = Awaited<ReturnType<typeof build>>

/** The person known on Telegram and on Zalo (two accounts), the Telegram one first. */
const onTwoChannels = (world: World): void => {
    world.contacts.get.mockResolvedValue(
        contact([
            identity({ id: "i-1" }),
            identity({ id: "i-2", provider: "zalo", account: "z1", value: "123", at: "2026-11-02T10:00:00.000Z" }),
        ]),
    )
}

describe("ChannelSendExecutorService sending", () => {
    it("registers the one customer send", async () => {
        const { executor, registry } = await build()
        executor.onModuleInit()
        expect(executor.effect).toBe(TOOL.customerMessageSend)
        expect(registry.addExecutor).toHaveBeenCalledWith(executor)
    })

    it("claims the send key, pushes to the person's identity on the woken route and answers the delivery receipt", async () => {
        const { executor, delivery, ledger } = await build()

        const answered = await executor.execute(TURN, SEND, CALL)

        expect(answered).toEqual({
            kind: "message",
            id: "run:1",
            facts: {
                delivered: true,
                state: "delivered",
                reason: null,
                ...WHERE,
                providerMessageId: null,
                at: NOW.toISOString(),
                sendKey: "run:1",
            },
        })
        expect(delivery.deliverToPerson).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            routeId: "route-1",
            channel: "telegram",
            accountId: TELEGRAM_ACCOUNT,
            userId: "555",
            sendKey: "run:1",
            text: "Hello",
            windowChecked: true,
        })
        expect(ledger.rows).toHaveLength(1)
        expect(ledger.rows[0]).toMatchObject({
            sendKey: "run:1",
            routeId: "route-1",
            contactId: PERSON,
            agentId: "a-1",
            runId: null,
            text: "Hello",
            state: "delivered",
            channel: "telegram",
            accountId: TELEGRAM_ACCOUNT,
            attachmentCount: 0,
        })
    })

    it("reads and writes no chatbot record and keeps no draft: it claims the key, pushes once and tells the team nothing", async () => {
        const { executor, delivery, team, ledger } = await build()

        await executor.execute(TURN, SEND, CALL)

        expect(delivery.deliverToPerson).toHaveBeenCalledTimes(1)
        expect(ledger.rows).toHaveLength(1)
        expect(team.execute).not.toHaveBeenCalled()
    })

    it("keeps the pictures the caller gives (a payment QR) in order, and sums them up in the ledger; the card is the node's, never sent to the channel", async () => {
        const { executor, delivery, ledger } = await build()
        const qr = { url: "https://img.example/qr.png", caption: "QR" }
        const card = { orderNo: "DH-1", lines: [{ name: "Basket", qty: 1 }], amountText: "2.000", address: "", paid: false }

        await executor.execute(TURN, { ...SEND, images: [qr], order: card }, CALL)

        expect(delivery.deliverToPerson).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("Hello"), images: [qr] }))
        expect(ledger.rows[0]).toMatchObject({ attachmentCount: 1, attachmentKinds: ["image"] })
    })

    it("refuses a card that is not of a line card's shape, more than ten pictures, empty words, before anything is claimed", async () => {
        const { executor, ledger } = await build()
        const many = Array.from({ length: 11 }, () => ({ url: "https://img.example/a.png", caption: "" }))

        for (const bad of [{ ...SEND, order: { orderNo: "DH-1" } }, { ...SEND, images: many }, { text: "" }])
            await expect(executor.execute(TURN, bad, CALL)).rejects.toMatchObject({ code: ChatNodePortsErrorCode.InvalidPayload })
        expect(ledger.rows).toEqual([])
    })

    it("answers an unknown verdict as sent with state unknown, settled unknown in the ledger, so a retry never says it twice", async () => {
        const { executor, delivery, ledger } = await build()
        delivery.deliverToPerson.mockResolvedValue({ delivered: false, failure: null, outcome: "ambiguous" })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({
            kind: "message",
            id: "run:1",
            facts: { delivered: false, state: "unknown", reason: "delivery_outcome_unknown", ...WHERE },
        })
        expect(ledger.rows[0]?.state).toBe("unknown")
    })
})

describe("ChannelSendExecutorService the delivery ledger", () => {
    it("answers the SAME receipt for the same send key asked again, and asks the provider once", async () => {
        const { executor, delivery, ledger } = await build()

        const first = await executor.execute(TURN, SEND, CALL)
        const again = await executor.execute(TURN, SEND, CALL)

        expect(again).toEqual(first)
        expect(delivery.deliverToPerson).toHaveBeenCalledTimes(1)
        expect(ledger.rows).toHaveLength(1)
    })

    it("answers a key in flight (claimed, never settled) as unknown and never sends it again (engine-core rule 9)", async () => {
        const { executor, delivery, ledger, deliveries } = await build()
        await deliveries.claim("ws-1", {
            sendKey: "run:1",
            routeId: "route-1",
            contactId: PERSON,
            agentId: "a-1",
            runId: "t",
            stepKey: null,
            text: "Hello",
            attachmentCount: 0,
            attachmentKinds: [],
            channel: "telegram",
            accountId: TELEGRAM_ACCOUNT,
        })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({
            kind: "message",
            facts: { delivered: false, state: "unknown", reason: "delivery_outcome_unknown" },
        })
        expect(delivery.deliverToPerson).not.toHaveBeenCalled()
        expect(ledger.rows).toHaveLength(1)
    })

    it("answers the earlier receipt of a delivered key even when the window has closed since", async () => {
        const world = await build()
        const first = await world.executor.execute(TURN, SEND, CALL)
        world.contacts.get.mockResolvedValue(contact([identity({ provider: "zalo", account: "z1", value: "123" })]))
        world.lines.lastHeardAt.mockResolvedValue(new Date(NOW.getTime() - ZALO_FREE_WINDOW_MS - 1))

        await expect(world.executor.execute(TURN, SEND, CALL)).resolves.toEqual(first)
    })

    it("records a refusal as a ledger row with the words not told, and a later try of the same key is claimed again", async () => {
        const { executor, delivery, ledger, memory } = await build()
        memory.snapshot.mockResolvedValue({
            subject: { key: "contact:k-1", contactId: PERSON, conversationId: null },
            lead: { careOptOut: true },
            workflows: {},
        })
        const unprompted = { ...SEND, contactId: PERSON, channel: "telegram" }
        await expect(executor.execute({ ...TURN, conversationId: null }, unprompted, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: "customer_opted_out",
            facts: { state: "refused", reason: "customer_opted_out", ...WHERE },
        })
        expect(ledger.rows[0]).toMatchObject({ sendKey: "run:1", state: "refused", reason: "customer_opted_out", text: "Hello" })

        memory.snapshot.mockResolvedValue(null)
        await expect(executor.execute({ ...TURN, conversationId: null }, unprompted, CALL)).resolves.toMatchObject({
            kind: "message",
        })
        expect(delivery.deliverToPerson).toHaveBeenCalledTimes(1)
        expect(ledger.rows).toHaveLength(1)
        expect(ledger.rows[0]?.state).toBe("delivered")
    })

    it("settles a busy token refresh as refused and throws, so the run engine's retry claims the key again and sends", async () => {
        const { executor, delivery, ledger } = await build()
        delivery.deliverToPerson.mockRejectedValueOnce(new ChannelsError({ code: ChannelsErrorCode.ZaloRefreshBusy }))

        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.DeliveryRateLimited,
        })
        expect(ledger.rows[0]?.state).toBe("refused")

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({ kind: "message", facts: { state: "delivered" } })
        expect(ledger.rows).toHaveLength(1)
    })
})

describe("ChannelSendExecutorService rules", () => {
    it("refuses when the person is no one the workspace holds, or the call and the run name nobody", async () => {
        const { executor, contacts, ledger } = await build()

        contacts.get.mockResolvedValue(null)
        await expect(executor.execute(TURN, { ...SEND, contactId: "ghost" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "no_recipient",
            facts: { contactId: "ghost" },
        })
        await expect(
            executor.execute({ ...TURN, contactId: null, conversationId: null }, SEND, CALL),
        ).resolves.toEqual({ kind: "refused", id: "no_recipient", facts: {} })
        expect(ledger.rows).toEqual([])
    })

    it("refuses the connection the person came in on when the workspace no longer has it, and stores nothing but the refusal", async () => {
        const { executor, connections, delivery, ledger } = await build()
        connections.find.mockResolvedValue(null)

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({ kind: "refused", id: "connection_missing" })
        expect(delivery.deliverToPerson).not.toHaveBeenCalled()
        expect(ledger.rows[0]).toMatchObject({ state: "refused", reason: "connection_missing" })
    })

    it("asks no connection of the website, a channel of no connection", async () => {
        const { executor, contacts, connections } = await build()
        contacts.get.mockResolvedValue(contact([identity({ provider: "website", account: "site-1", value: "visitor-1" })]))

        await expect(executor.execute({ ...TURN, conversationId: null }, SEND, CALL)).resolves.toMatchObject({ kind: "message" })
        expect(connections.find).not.toHaveBeenCalled()
    })
})

// Ledger (ROAD Opus-1d, 2026-11-14): "who may speak" (a reply refused on a route another agent keeps, `not_speaking`) is deleted with the
// engine's agent conversation hold (ruling R35): a send no longer reads any keeper of a route.

describe("ChannelSendExecutorService reaching the customer", () => {
    /** The person known only on Zalo, with the run woken on that route. */
    const onZalo = async (): Promise<World> => {
        const world = await build()
        world.contacts.get.mockResolvedValue(contact([identity({ provider: "zalo", account: "z1", value: "123" })]))
        world.access.judgeSend.mockResolvedValue({ kind: "allow", provider: "zalo_oa", connectionId: "z1" })
        await world.routes.ensure("ws-1", { contactId: PERSON, channel: "zalo", accountId: "z1" })
        return world
    }
    const zaloTurn = { ...TURN, conversationId: "route-2" }

    it("refuses on Zalo after the free window, read from the person's last line in the core store, before anything is pushed; sends inside it", async () => {
        const { executor, lines, delivery, ledger, ...rest } = await onZalo()
        void rest
        lines.lastHeardAt.mockResolvedValue(new Date(NOW.getTime() - ZALO_FREE_WINDOW_MS - 1))

        await expect(executor.execute(zaloTurn, SEND, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: "outside_window",
            facts: { channel: "zalo", accountId: "z1" },
        })
        expect(lines.lastHeardAt).toHaveBeenCalledWith("ws-1", "route-2")
        expect(delivery.deliverToPerson).not.toHaveBeenCalled()
        expect(ledger.rows[0]).toMatchObject({ state: "refused", reason: "outside_window" })

        lines.lastHeardAt.mockResolvedValue(new Date(NOW.getTime() - 1000))
        await expect(executor.execute(zaloTurn, SEND, { key: "run:2", dedupeKey: null })).resolves.toMatchObject({ kind: "message" })
    })

    it("treats a Zalo person who never wrote in as open", async () => {
        const { executor } = await onZalo()

        await expect(executor.execute(zaloTurn, SEND, CALL)).resolves.toMatchObject({ kind: "message" })
    })

    it("records the refusal when the channel knows no recipient (no id, an imported placeholder), pushing nothing", async () => {
        for (const value of ["", "imp-x"]) {
            const world = await onZalo()
            world.contacts.get.mockResolvedValue(contact([identity({ provider: "zalo", account: "z1", value })]))

            await expect(world.executor.execute(zaloTurn, SEND, CALL)).resolves.toMatchObject({
                kind: "refused",
                id: "recipient_not_linked",
                facts: { state: "refused", reason: "recipient_not_linked" },
            })
            expect(world.delivery.deliverToPerson).not.toHaveBeenCalled()
            expect(world.ledger.rows[0]).toMatchObject({ state: "refused", reason: "recipient_not_linked" })
        }
    })
})

describe("ChannelSendExecutorService channel verdicts", () => {
    it.each([
        ["channel_plan", "plan_blocked"],
        ["zalo_recipient", "recipient_not_linked"],
        [null, "not_delivered"],
    ] as const)("answers a rejection for %s as the refusal %s, settled refused in the ledger", async (failure, reason) => {
        const { executor, delivery, ledger } = await build()
        delivery.deliverToPerson.mockResolvedValue({ delivered: false, failure, outcome: "rejected" })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: reason,
            facts: { ...WHERE, state: "refused", reason, failure },
        })
        expect(ledger.rows[0]).toMatchObject({ state: "refused", reason })
    })

    it("throws for a channel that is not taking messages for now, so the run engine tries again", async () => {
        const { executor, delivery, ledger } = await build()
        delivery.deliverToPerson.mockResolvedValue({ delivered: false, failure: "zalo_quota", outcome: "rejected" })

        await expect(executor.execute(TURN, SEND, CALL)).rejects.toMatchObject({
            code: ChatNodePortsErrorCode.DeliveryRateLimited,
        })
        expect(ledger.rows[0]).toMatchObject({ state: "refused", reason: "zalo_quota" })
    })

    it("carries the Zalo route that took the message (consultation, zns) in the receipt", async () => {
        const { executor, delivery } = await build()
        delivery.deliverToPerson.mockResolvedValue({ delivered: true, failure: null, outcome: "acknowledged", via: "zns" })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({ facts: { via: "zns" } })
    })
})

describe("ChannelSendExecutorService addressed by the person", () => {
    it("writes to the person the run serves on the route it was woken on, and to the one named on the channel asked for", async () => {
        const world = await build()
        onTwoChannels(world)
        const { executor, delivery } = world

        await executor.execute(TURN, { text: "Hello" }, CALL)
        expect(delivery.deliverToPerson).toHaveBeenLastCalledWith(expect.objectContaining({ channel: "telegram", userId: "555" }))

        await executor.execute(TURN, { text: "Hello", channel: "zalo" }, { key: "run:2", dedupeKey: null })
        expect(delivery.deliverToPerson).toHaveBeenLastCalledWith(expect.objectContaining({ channel: "zalo", accountId: "z1", userId: "123" }))
    })

    it("a run woken on no route writes to the person's newest channel identity", async () => {
        const world = await build()
        onTwoChannels(world)

        await world.executor.execute({ ...TURN, conversationId: null }, SEND, CALL)

        expect(world.delivery.deliverToPerson).toHaveBeenLastCalledWith(expect.objectContaining({ channel: "zalo", userId: "123" }))
    })

    it("an account named picks among the person's accounts of a channel; several of one channel with none named is ambiguous", async () => {
        const world = await build()
        world.contacts.get.mockResolvedValue(
            contact([
                identity({ id: "i-1", provider: "zalo", account: "z1", value: "1" }),
                identity({ id: "i-2", provider: "zalo", account: "z2", value: "2" }),
            ]),
        )
        const none = { ...TURN, conversationId: null }

        await expect(world.executor.execute(none, { ...SEND, channel: "zalo" }, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: "channel_ambiguous",
            facts: { channels: ["zalo"] },
        })
        await world.executor.execute(none, { ...SEND, accountId: "z2" }, { key: "run:2", dedupeKey: null })
        expect(world.delivery.deliverToPerson).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: "z2", userId: "2" }))
    })

    it("refuses a person with no identity on the channel asked for, naming the channels they have", async () => {
        const { executor, ledger } = await build()

        await expect(executor.execute(TURN, { ...SEND, channel: "zalo" }, CALL)).resolves.toEqual({
            kind: "refused",
            id: "no_channel_identity",
            facts: { contactId: PERSON, channel: "zalo", accountId: null, channels: ["telegram"] },
        })
        expect(ledger.rows).toEqual([])
    })

    it("speaks unprompted to a person on another route, making the route; and refuses one who opted out", async () => {
        const world = await build()
        onTwoChannels(world)

        await expect(world.executor.execute(TURN, { ...SEND, channel: "zalo" }, CALL)).resolves.toMatchObject({
            kind: "message",
            facts: { routeId: "route-2", channel: "zalo" },
        })
        world.memory.snapshot.mockResolvedValue({
            subject: { key: "contact:k-1", contactId: PERSON, conversationId: null },
            lead: { careOptOut: true },
            workflows: {},
        })
        await expect(world.executor.execute(TURN, { ...SEND, channel: "zalo" }, { key: "run:2", dedupeKey: null })).resolves.toMatchObject({
            id: "customer_opted_out",
        })
        // The opt-out reads the woken route as a reply: the person's own thread is never refused as unprompted.
        await expect(world.executor.execute(TURN, SEND, { key: "run:3", dedupeKey: null })).resolves.toMatchObject({ kind: "message" })
    })
})

describe("ChannelSendExecutorService when the owner approves first", () => {
    it("is not its business: the tool door asked at the call (rights rule 11), so the executor sends what reaches it, draws no draft and posts no owner notice", async () => {
        const { executor, access, delivery, team, ledger } = await build()
        // Whatever the verdict kind the accounts judge once returned, only a refusal stops the executor: the attachment is all it judges.
        access.judgeSend.mockResolvedValue({ kind: "allow", provider: "telegram", connectionId: TELEGRAM_ACCOUNT })

        await expect(executor.execute(TURN, SEND, CALL)).resolves.toMatchObject({ kind: "message", facts: { state: "delivered", ...WHERE } })

        expect(delivery.deliverToPerson).toHaveBeenCalledTimes(1)
        expect(team.execute).not.toHaveBeenCalled()
        expect(ledger.rows[0]).toMatchObject({ sendKey: CALL.key, state: "delivered" })
    })

    it("answers a replay of an approved call with the first receipt and asks the provider once (the ledger fence)", async () => {
        const { executor, delivery } = await build()

        const first = await executor.execute(TURN, SEND, CALL)
        const again = await executor.execute(TURN, SEND, CALL)

        expect(again).toEqual(first)
        expect(delivery.deliverToPerson).toHaveBeenCalledTimes(1)
    })
})

describe("ChannelSendExecutorService refusalFor: what it would refuse, judged before anyone is asked, writing nothing", () => {
    const onZalo = async (): Promise<World> => {
        const world = await build()
        world.contacts.get.mockResolvedValue(contact([identity({ provider: "zalo", account: "z1", value: "123" })]))
        world.access.attachmentOf.mockResolvedValue({ kind: "allow", provider: "zalo_oa", connectionId: "z1" })
        await world.routes.ensure("ws-1", { contactId: PERSON, channel: "zalo", accountId: "z1" })
        return world
    }
    const zaloTurn = { ...TURN, conversationId: "route-2" }
    const closedWindow = new Date(NOW.getTime() - ZALO_FREE_WINDOW_MS - 1)

    it("a closed reply window is the refusal execute would answer, and nothing is written: no ledger row, no audit, no provider call", async () => {
        const { executor, lines, delivery, ledger, access } = await onZalo()
        lines.lastHeardAt.mockResolvedValue(closedWindow)

        await expect(executor.refusalFor(zaloTurn, SEND, CALL)).resolves.toMatchObject({
            kind: "refused",
            id: "outside_window",
            facts: { channel: "zalo", accountId: "z1", reason: "outside_window" },
        })

        expect(ledger.rows).toEqual([])
        expect(access.judgeSend).not.toHaveBeenCalled()
        expect(access.effectJudged).not.toHaveBeenCalled()
        expect(delivery.deliverToPerson).not.toHaveBeenCalled()
    })

    it("an open window refuses nothing: the approval may be asked", async () => {
        const { executor, lines } = await onZalo()
        lines.lastHeardAt.mockResolvedValue(new Date(NOW.getTime() - 1000))

        await expect(executor.refusalFor(zaloTurn, SEND, CALL)).resolves.toBeNull()
    })

    it("approved while the window was open, closed by the time it runs: execute refuses at run (the same rules judge again)", async () => {
        const { executor, lines, delivery, ledger } = await onZalo()
        lines.lastHeardAt.mockResolvedValue(new Date(NOW.getTime() - 1000))
        await expect(executor.refusalFor(zaloTurn, SEND, CALL)).resolves.toBeNull()

        lines.lastHeardAt.mockResolvedValue(closedWindow)
        await expect(executor.execute(zaloTurn, SEND, CALL)).resolves.toMatchObject({ kind: "refused", id: "outside_window" })

        expect(delivery.deliverToPerson).not.toHaveBeenCalled()
        expect(ledger.rows[0]).toMatchObject({ state: "refused", reason: "outside_window" })
    })

    it("refuses for an agent not attached to the account (read quietly), an opted-out person, a route another agent keeps, and an unknown person", async () => {
        const detached = await build()
        detached.access.attachmentOf.mockResolvedValue({ kind: "refuse", reason: "not_attached", providers: ["telegram"] })
        await expect(detached.executor.refusalFor(TURN, SEND, CALL)).resolves.toMatchObject({
            id: "channel_no_access",
            facts: { reason: "not_attached", provider: "telegram" },
        })
        expect(detached.access.judgeSend).not.toHaveBeenCalled()

        const optedOut = await build()
        optedOut.memory.snapshot.mockResolvedValue({ lead: { careOptOut: true } } as never)
        await expect(optedOut.executor.refusalFor({ ...TURN, conversationId: null }, SEND, CALL)).resolves.toMatchObject({ id: "customer_opted_out" })

        const nobody = await build()
        nobody.contacts.get.mockResolvedValue(null)
        await expect(nobody.executor.refusalFor(TURN, SEND, CALL)).resolves.toMatchObject({ id: "no_recipient" })
    })

    it("makes no route for a person with none yet, and leaves a key already delivered to execute's receipt", async () => {
        const fresh = await build()
        fresh.contacts.get.mockResolvedValue(contact([identity({ provider: "zalo", account: "z9", value: "9" })]))
        fresh.access.attachmentOf.mockResolvedValue({ kind: "allow", provider: "zalo_oa", connectionId: "z9" })
        const before = fresh.routeRows.rows.length
        await expect(fresh.executor.refusalFor({ ...TURN, conversationId: null }, SEND, CALL)).resolves.toBeNull()
        expect(fresh.routeRows.rows).toHaveLength(before)

        const sent = await build()
        await sent.executor.execute(TURN, SEND, CALL)
        await expect(sent.executor.refusalFor(TURN, SEND, CALL)).resolves.toBeNull()
    })
})

describe("ChannelSendExecutorService keeps the line whole in the core store", () => {
    it("claims the send with its pictures by address, its order card and the member who typed it", async () => {
        const { executor, deliveries } = await build()
        const claim = jest.spyOn(deliveries, "claim")
        const order = { orderNo: "DH-7", lines: [], amountText: "120.000 đ", address: "", paid: false }

        await executor.execute(
            { ...TURN, memberId: "m-1" },
            { ...SEND, images: [{ url: "https://img.example/qr.png", caption: "QR" }], order },
            CALL,
        )

        expect(claim.mock.calls[0]?.[1]).toMatchObject({
            sendKey: CALL.key,
            attachmentCount: 1,
            files: [{ url: "https://img.example/qr.png", name: "", contentType: "", caption: "QR" }],
            order,
            memberId: "m-1",
        })
    })

    it("writes no run for a job turn (a reply a person typed) and the member who typed it, and the run and step of a step's send", async () => {
        const { executor, deliveries } = await build()
        const claim = jest.spyOn(deliveries, "claim")
        const step = { nodeKey: "tell", versionId: "v-1", workflowId: null }

        await executor.execute({ ...TURN, memberId: "m-1" }, SEND, CALL)
        await executor.execute({ ...TURN, step }, SEND, { ...CALL, key: "run:step" })

        expect(claim.mock.calls[0]?.[1]).toMatchObject({ runId: null, stepKey: null, memberId: "m-1" })
        expect(claim.mock.calls[1]?.[1]).toMatchObject({ runId: "t", stepKey: "tell", memberId: null })
    })

    it("claims a plain send with no files, no order and no member", async () => {
        const { executor, deliveries } = await build()
        const claim = jest.spyOn(deliveries, "claim")

        await executor.execute(TURN, SEND, CALL)

        expect(claim.mock.calls[0]?.[1]).toMatchObject({ files: [], memberId: null })
        expect(claim.mock.calls[0]?.[1]).not.toHaveProperty("order")
    })
})
