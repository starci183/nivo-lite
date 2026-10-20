import { mock, mockEntityManager } from "@starci/jest-preset"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { GuestContext } from "./gateway-turns.contracts"
import { GatewayContextService } from "./gateway-context.service"
import { HubNotesService } from "./hub-notes.service"
import { AGENT_NAME, INSERT_OWNERSHIP_EVENT, MOVE_CONVERSATION } from "./persistence/gateway-turns.sql"

const CONVERSATION: TurnConversation = {
    id: "c1",
    workspaceId: "ws",
    channel: "zalo",
    externalId: "z1:old",
    connectionId: "conn",
    leadId: "l1",
    handledBy: null,
    visitorName: "Lan Zalo",
    installationId: "i1",
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

const CHECKED_IN: GuestContext = {
    guestId: "g1",
    name: "Lan",
    tier: "vip",
    stayId: "s1",
    room: "302",
    stage: { kind: "checked_in" },
}

const build = (moved: ReadonlyArray<unknown> = [{ id: "c1" }]) => {
    const entityManager = mockEntityManager()
    const answers = new Map<string, unknown>([
        [MOVE_CONVERSATION, moved],
        [INSERT_OWNERSHIP_EVENT, []],
        [AGENT_NAME, [{ name: "AI CSKH" }]],
    ])
    entityManager.query.mockImplementation((query: string) => Promise.resolve(answers.get(query)))
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key: string, params?: Readonly<Record<string, string | number>>) =>
        params === undefined || Object.keys(params).length === 0 ? key : `${key} ${JSON.stringify(params)}`,
    )
    let now = Date.parse("2026-10-24T05:00:00Z")
    const clock = { now: () => new Date(now) }
    const gateway = mock<McpGatewayService>()
    gateway.agentsGranted.mockImplementation((_ws: string, tools: ReadonlyArray<string>) =>
        Promise.resolve(tools.includes("hakuen.keycode.reveal") ? ["care"] : ["sales"]),
    )
    const notes = mock<HubNotesService>()
    const service = new GatewayContextService(entityManager, catalog, clock, gateway, notes)
    const advance = (ms: number): void => {
        now += ms
    }
    return { service, entityManager, gateway, notes, advance }
}

describe("GatewayContextService", () => {
    it("serves the hotel when the agent holds a HAKUEN grant other than never", async () => {
        const { service, gateway } = build()
        gateway.grantsOf.mockResolvedValueOnce([
            { tool: "hakuen.keycode.reveal", mode: "never", constraints: [], limitVnd: null },
        ])
        await expect(service.servesHotel(CONVERSATION)).resolves.toBe(false)
        gateway.grantsOf.mockResolvedValueOnce([{ tool: "hakuen.*", mode: "auto", constraints: [], limitVnd: null }])
        await expect(service.servesHotel(CONVERSATION)).resolves.toBe(true)
    })

    it("names the desk agents, or null without grants", async () => {
        const { service, gateway } = build()
        await expect(service.deskAgents("ws")).resolves.toEqual({ sales: "sales", care: "care" })
        gateway.agentsGranted.mockResolvedValue([])
        await expect(service.deskAgents("ws")).resolves.toEqual({ sales: null, care: null })
    })

    it("reads the guest and the stay once, caches them for a minute and forgets on demand", async () => {
        const { service, gateway, advance } = build()
        gateway.call
            .mockResolvedValueOnce({
                ok: true,
                value: { found: true, guest: { guestId: "g1", name: "Lan", tier: "vip" } },
            })
            .mockResolvedValueOnce({
                ok: true,
                value: { found: true, stay: { stayId: "s1", roomNumber: "302", status: "checked_in" } },
            })
        await expect(service.contextOf(CONVERSATION)).resolves.toEqual(CHECKED_IN)
        expect(gateway.call.mock.calls.map((call) => [call[1], call[2]])).toEqual([
            ["hakuen.guest.findByChannelIdentity", { channel: "zalo", externalId: "z1" }],
            ["hakuen.stay.current", { guestId: "g1" }],
        ])
        await service.contextOf(CONVERSATION)
        expect(gateway.call).toHaveBeenCalledTimes(2)
        advance(61_000)
        gateway.call.mockResolvedValueOnce({ ok: true, value: { guest: null } })
        await expect(service.contextOf(CONVERSATION)).resolves.toMatchObject({ guestId: null, stayId: null })
        service.forget(CONVERSATION)
        gateway.call.mockResolvedValueOnce({ ok: false, code: "unavailable", detail: "x" })
        await expect(service.contextOf(CONVERSATION)).resolves.toBeNull()
        gateway.call
            .mockResolvedValueOnce({ ok: true, value: { guest: { guestId: "g1" } } })
            .mockResolvedValueOnce({ ok: false, code: "unavailable", detail: "x" })
        await expect(service.contextOf(CONVERSATION)).resolves.toBeNull()
        await expect(service.contextOf({ ...CONVERSATION, externalId: null })).resolves.toBeNull()
    })

    it("writes the brief of what is known", () => {
        const { service } = build()
        expect(service.briefOf(CHECKED_IN)).toEqual([
            "gatewayTurns.contract",
            'gatewayTurns.guestKnown {"name":"Lan","tier":"vip"}',
            'gatewayTurns.stayKnown {"room":"302","stage":"checked_in"}',
        ])
        expect(service.briefOf({ ...CHECKED_IN, tier: "", room: "" })[1]).toContain('"tier":"-"')
        expect(service.briefOf({ ...CHECKED_IN, room: "" })[2]).toContain('"room":"-"')
        expect(service.briefOf({ ...CHECKED_IN, guestId: null, stayId: null })).toEqual(["gatewayTurns.contract"])
    })

    it("moves a checked-in guest to care, records it and notes both rooms", async () => {
        const { service, entityManager, notes } = build()
        await expect(service.route(CONVERSATION, CHECKED_IN)).resolves.toEqual({ role: "care", reason: "checked_in" })
        expect(entityManager.query).toHaveBeenCalledWith(MOVE_CONVERSATION, ["ws", "c1", "care"])
        expect(entityManager.query).toHaveBeenCalledWith(INSERT_OWNERSHIP_EVENT, [
            "ws",
            "c1",
            "sales",
            "care",
            "checked_in",
            "s1",
        ])
        expect(notes.post.mock.calls.map((call) => call[1])).toEqual(["sales", "care"])
        expect(notes.post.mock.calls[0]?.[0].title).toContain("Lan (P.302)")
    })

    it("keeps the owner when a person holds it, it is already the owner, nobody is granted or the move did not apply", async () => {
        const { service, entityManager, gateway } = build([])
        await expect(service.route({ ...CONVERSATION, handledBy: "staff" }, CHECKED_IN)).resolves.toBeNull()
        await expect(service.route(CONVERSATION, { ...CHECKED_IN, stage: { kind: "none" } })).resolves.toBeNull()
        await expect(service.route(CONVERSATION, CHECKED_IN)).resolves.toBeNull()
        expect(entityManager.query.mock.calls.map((call) => call[0])).toEqual([MOVE_CONVERSATION])
        gateway.agentsGranted.mockResolvedValue([])
        await expect(service.route(CONVERSATION, CHECKED_IN)).resolves.toBeNull()
    })

    it("names the guest from the conversation when HAKUEN has no name or room, and copes with a missing agent name", async () => {
        const { service, notes, entityManager } = build()
        entityManager.query.mockImplementation((query: string) =>
            Promise.resolve(query === MOVE_CONVERSATION ? [{ id: "c1" }] : []),
        )
        await service.route({ ...CONVERSATION, visitorName: null }, { ...CHECKED_IN, name: "", room: "" })
        expect(notes.post.mock.calls[0]?.[0].title).toContain('"name":""')
        await service.route(CONVERSATION, { ...CHECKED_IN, name: "", room: "" })
        expect(notes.post.mock.calls[2]?.[0].title).toContain('"name":"Lan Zalo"')
    })

    it("names the gateway caller of the conversation", () => {
        expect(build().service.callerOf(CONVERSATION)).toEqual({
            workspaceId: "ws",
            agentId: "sales",
            conversationId: "c1",
            workItemId: null,
        })
    })
})
