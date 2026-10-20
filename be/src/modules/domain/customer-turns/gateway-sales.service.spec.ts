import { mock, mockEntityManager } from "@starci/jest-preset"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { GatewayCallResult, JsonObject } from "@modules/domain/mcp-gateway"
import type { MessageCatalog } from "@modules/platform/i18n"
import { GatewayContextService } from "./gateway-context.service"
import type { HotelRequest } from "./gateway-turns.contracts"
import { GatewaySalesService } from "./gateway-sales.service"
import { HubNotesService } from "./hub-notes.service"
import { UPSERT_IDENTITY_LINK } from "./persistence/gateway-turns.sql"

const CTX: WorkContext = { workspaceId: "ws", actor: "OpenClaw", locale: "vi" }
const CONVERSATION: TurnConversation = {
    id: "c1",
    workspaceId: "ws",
    channel: "zalo",
    externalId: "z1",
    connectionId: "conn",
    leadId: null,
    handledBy: null,
    visitorName: null,
    installationId: null,
    agent: {
        id: "sales",
        name: "AI Sales",
        handle: "ai-sales",
        role: "",
        module: "chatbot",
        instructions: "",
        knowledge: "",
        approvalRule: "",
        greeting: "",
    },
}
const SPA: HotelRequest = {
    intent: "spa_hold",
    service: "massage-60",
    date: "2026-10-24",
    time: "15:00",
    partySize: 2,
    nights: 1,
    roomType: "",
    name: "Lan",
    phone: "0900",
    discountPct: null,
}
const ROOM: HotelRequest = { ...SPA, intent: "room_hold", service: "", roomType: "deluxe", nights: 2, phone: null }
const UNAVAILABLE: GatewayCallResult = { ok: false, code: "unavailable", detail: "MCP_TIMEOUT" }
const ok = (value: JsonObject): GatewayCallResult => ({ ok: true, value })
const SLOTS = ok({ slots: [{ slotId: "slot-15", startsAt: "2026-10-24T15:00:00+07:00" }] })

const build = (answers: Readonly<Record<string, GatewayCallResult>> = {}) => {
    const entityManager = mockEntityManager()
    entityManager.query.mockResolvedValue([])
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key: string, params?: Readonly<Record<string, string | number>>) =>
        params === undefined || Object.keys(params).length === 0 ? key : `${key} ${JSON.stringify(params)}`,
    )
    const gateway = mock<McpGatewayService>()
    const defaults: Readonly<Record<string, GatewayCallResult>> = {
        "hakuen.guest.upsertByChannelIdentity": ok({ guestId: "g1" }),
        "hakuen.spa.findSlots": SLOTS,
        "hakuen.spa.hold": ok({ holdId: "h1", expiresAt: "2026-10-24T08:30:00Z" }),
        "hakuen.booking.hold": ok({ holdId: "bh1", expiresAt: "2026-10-20T08:30:00Z" }),
        "hakuen.booking.confirm": ok({ bookingId: "B-1", status: "confirmed" }),
        "hakuen.rooms.searchAvailability": ok({ roomTypes: [{ code: "deluxe", name: "Deluxe", available: 2 }] }),
        "hakuen.rates.quote": ok({ nights: [{ rateVnd: 1_500_000 }], totalVnd: 3_000_000 }),
        ...answers,
    }
    gateway.call.mockImplementation((_caller, name: string) => Promise.resolve(defaults[name] ?? UNAVAILABLE))
    const context = mock<GatewayContextService>()
    context.callerOf.mockReturnValue({ workspaceId: "ws", agentId: "sales", conversationId: "c1", workItemId: null })
    const notes = mock<HubNotesService>()
    const engine = mock<WorkEngineService>()
    const service = new GatewaySalesService(entityManager, catalog, gateway, context, notes, engine)
    const called = (): ReadonlyArray<string> => gateway.call.mock.calls.map((call) => call[1])
    return { service, entityManager, gateway, context, notes, engine, called }
}

describe("GatewaySalesService", () => {
    it("asks the name before any hold", async () => {
        const { service, called } = build()
        await expect(service.settle(CTX, CONVERSATION, "m1", { ...SPA, name: "" })).resolves.toEqual({
            reply: "gatewayTurns.askName",
            lines: [],
        })
        expect(called()).toEqual([])
    })

    it("lists free spa slots, or says the time is full", async () => {
        const { service } = build()
        await expect(
            service.settle(CTX, CONVERSATION, "m1", { ...SPA, intent: "spa_slots", time: null }),
        ).resolves.toEqual({
            reply: 'gatewayTurns.slots {"slots":"15:00"}',
            lines: [],
        })
        const full = build({ "hakuen.spa.findSlots": ok({ slots: [] }) })
        await expect(
            full.service.settle(CTX, CONVERSATION, "m1", { ...SPA, intent: "spa_slots" }),
        ).resolves.toMatchObject({
            reply: "gatewayTurns.noSlot",
        })
        expect(full.gateway.call.mock.calls[0]?.[2]).toMatchObject({ after: "15:00" })
    })

    it("holds a spa slot for the named guest, links the identity and posts the held card", async () => {
        const { service, entityManager, notes, called, context } = build()
        const outcome = await service.settle(CTX, CONVERSATION, "m1", SPA)
        expect(outcome.reply).toContain("gatewayTurns.spaHeld")
        expect(outcome.reply).toContain('"time":"15:00"')
        expect(outcome.lines).toEqual(["gatewayTurns.cardHeld"])
        expect(called()).toEqual(["hakuen.guest.upsertByChannelIdentity", "hakuen.spa.findSlots", "hakuen.spa.hold"])
        expect(entityManager.query).toHaveBeenCalledWith(UPSERT_IDENTITY_LINK, [
            "ws",
            "hakuen",
            "zalo",
            "z1",
            null,
            "g1",
        ])
        expect(notes.post.mock.calls[0]?.[0].type).toBe("booking_held")
        expect(context.forget).toHaveBeenCalledWith(CONVERSATION)
    })

    it("holds without a date when the guest gave none", async () => {
        const { service, notes } = build()
        await expect(service.settle(CTX, CONVERSATION, "m1", { ...SPA, date: null })).resolves.toMatchObject({
            lines: ["gatewayTurns.cardHeld"],
        })
        await expect(service.settle(CTX, CONVERSATION, "m1", { ...ROOM, date: null })).resolves.toMatchObject({
            lines: ["gatewayTurns.cardHeld"],
        })
        expect(notes.post.mock.calls.map((call) => call[0].fields[2]?.value)).toEqual(["15:00", ""])
    })

    it("says the slot is gone when nothing is free at or after the time", async () => {
        const { service } = build({ "hakuen.spa.findSlots": ok({ slots: [] }) })
        await expect(service.settle(CTX, CONVERSATION, "m1", SPA)).resolves.toMatchObject({
            reply: "gatewayTurns.noSlot",
        })
    })

    it.each([
        ["hakuen.guest.upsertByChannelIdentity", UNAVAILABLE],
        ["hakuen.guest.upsertByChannelIdentity", ok({})],
        ["hakuen.spa.findSlots", UNAVAILABLE],
        ["hakuen.spa.hold", UNAVAILABLE],
    ])("answers the holding line and asks a person when %s fails", async (tool, result) => {
        const { service, engine, notes } = build({ [tool]: result })
        await expect(service.settle(CTX, { ...CONVERSATION, externalId: null }, "m1", SPA)).resolves.toEqual({
            reply: "gatewayTurns.holding",
            lines: [],
        })
        expect(engine.runWork).toHaveBeenCalledWith(
            CTX,
            expect.objectContaining({ action: "reply_customer", forceAsk: "unclear_outcome" }),
        )
        expect(notes.post).not.toHaveBeenCalled()
    })

    it("answers the holding line when the slot list fails", async () => {
        const { service } = build({ "hakuen.spa.findSlots": UNAVAILABLE })
        await expect(service.settle(CTX, CONVERSATION, "m1", { ...SPA, intent: "spa_slots" })).resolves.toMatchObject({
            reply: "gatewayTurns.holding",
        })
    })

    it("searches rooms with the quote of the first free type", async () => {
        const { service, gateway } = build()
        const outcome = await service.settle(CTX, CONVERSATION, "m1", { ...ROOM, intent: "room_search" })
        expect(outcome.reply).toContain("gatewayTurns.rooms")
        expect(outcome.reply).toContain("gatewayTurns.quote")
        expect(gateway.call.mock.calls[0]?.[2]).toEqual({
            checkIn: "2026-10-24",
            nights: 2,
            guests: 2,
            roomType: "deluxe",
        })
        const plain = build({ "hakuen.rates.quote": ok({ nights: [] }) })
        const noQuote = await plain.service.settle(CTX, CONVERSATION, "m1", {
            ...ROOM,
            intent: "room_search",
            roomType: "",
        })
        expect(noQuote.reply).not.toContain("gatewayTurns.quote")
        expect(plain.gateway.call.mock.calls[0]?.[2]).not.toHaveProperty("roomType")
        const failedQuote = build({ "hakuen.rates.quote": UNAVAILABLE })
        await expect(
            failedQuote.service.settle(CTX, CONVERSATION, "m1", { ...ROOM, intent: "room_search" }),
        ).resolves.not.toMatchObject({
            reply: "gatewayTurns.holding",
        })
    })

    it("says the hotel is full, or holds the line when the search fails", async () => {
        const full = build({ "hakuen.rooms.searchAvailability": ok({ roomTypes: [] }) })
        await expect(
            full.service.settle(CTX, CONVERSATION, "m1", { ...ROOM, intent: "room_search" }),
        ).resolves.toMatchObject({
            reply: "gatewayTurns.noRoom",
        })
        const down = build({ "hakuen.rooms.searchAvailability": UNAVAILABLE })
        await expect(
            down.service.settle(CTX, CONVERSATION, "m1", { ...ROOM, intent: "room_search" }),
        ).resolves.toMatchObject({
            reply: "gatewayTurns.holding",
        })
    })

    it("holds a room without a discount", async () => {
        const { service, called } = build()
        const outcome = await service.settle(CTX, CONVERSATION, "m1", ROOM)
        expect(outcome.reply).toContain("gatewayTurns.roomHeld")
        expect(called()).not.toContain("hakuen.booking.confirm")
    })

    it("confirms a discount within the limit", async () => {
        const { service } = build()
        await expect(service.settle(CTX, CONVERSATION, "m1", { ...ROOM, discountPct: 5 })).resolves.toEqual({
            reply: 'gatewayTurns.roomConfirmed {"name":"Lan","bookingId":"B-1"}',
            lines: [],
        })
    })

    it("sends a discount over the limit to the Sales room for approval and tells the guest", async () => {
        const { service, engine } = build({
            "hakuen.booking.confirm": { ok: false, code: "approval_required", reason: "price_exception" },
        })
        const outcome = await service.settle(CTX, CONVERSATION, "m1", { ...ROOM, discountPct: 20 })
        expect(outcome.reply).toContain("gatewayTurns.discountAsked")
        expect(outcome.lines).toEqual(["gatewayTurns.cardApproval"])
        const spec = engine.runWork.mock.calls[0]?.[1]
        expect(spec).toMatchObject({
            action: "gateway_call",
            forceAsk: "over_authority",
            dedupeKey: "gateway_call:hakuen.booking.confirm:message:m1",
        })
        expect(spec?.seed?.fields).toMatchObject({
            tool: "hakuen.booking.confirm",
            args_json: JSON.stringify({ holdId: "bh1", discountPct: 20 }),
            discount_pct: 20,
            conversation_id: "c1",
            agent_id: "sales",
        })
    })

    it("holds the line when the hold or the confirmation fails", async () => {
        const hold = build({ "hakuen.booking.hold": UNAVAILABLE })
        await expect(hold.service.settle(CTX, CONVERSATION, "m1", ROOM)).resolves.toMatchObject({
            reply: "gatewayTurns.holding",
        })
        const confirm = build({ "hakuen.booking.confirm": UNAVAILABLE })
        await expect(
            confirm.service.settle(CTX, CONVERSATION, "m1", { ...ROOM, discountPct: 5 }),
        ).resolves.toMatchObject({
            reply: "gatewayTurns.holding",
        })
    })

    it("stores no discount field for a gated call without one", async () => {
        const { service, engine } = build()
        await service.gate(CTX, CONVERSATION, "m2", {
            tool: "hakuen.booking.cancel",
            args: {},
            name: "Lan",
            replyOk: "ok",
            reason: "ask_mode",
        })
        expect(engine.runWork.mock.calls[0]?.[1].seed?.fields?.discount_pct).toBeNull()
    })
})
