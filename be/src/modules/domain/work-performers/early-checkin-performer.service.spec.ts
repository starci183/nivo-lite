import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import type { Proposal, WorkContext, WorkItem } from "@modules/domain/decisions"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import type { GatewayCallResult } from "@modules/domain/mcp-gateway"
import type { MessageCatalog } from "@modules/platform/i18n"
import { EarlyCheckinPerformerService, roomOfText } from "./early-checkin-performer.service"
import { WorkPerformersError, WorkPerformersErrorCode } from "./errors/work-performers.error"
import { FIND_LINKED_CONVERSATION } from "./persistence/early-checkin.sql"

const CTX: WorkContext = { workspaceId: "ws", actor: "Lễ tân A", locale: "vi" }
const ASKED: Proposal = { summary: "early_checkin", fields: { request: "phòng 302 khách xin nhận sớm", n: 1 } }
const STAY = {
    found: true,
    stay: { stayId: "s302", guestId: "g1", guestName: "Lan", roomNumber: "302", status: "reserved" },
}

const itemOf = (proposal: Proposal): WorkItem => {
    const item = mock<WorkItem>()
    Object.assign(item, { id: "w1", lead_id: null, proposal })
    return item
}

const build = (
    answers: Readonly<Record<string, GatewayCallResult>> = {},
    rows: ReadonlyArray<unknown> = [{ id: "c1" }],
) => {
    const entityManager = mockEntityManager()
    entityManager.query.mockResolvedValue(rows)
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation(
        (key: string, params?: Readonly<Record<string, string | number>>) => `${key} ${JSON.stringify(params ?? {})}`,
    )
    const clock = { now: () => new Date("2026-10-24T03:00:00Z") }
    const gateway = mock<McpGatewayService>()
    gateway.agentsGranted.mockResolvedValue(["care"])
    const defaults: Readonly<Record<string, GatewayCallResult>> = {
        "hakuen.stay.current": { ok: true, value: STAY },
        "hakuen.stay.checkIn": { ok: true, value: { stayId: "s302", status: "checked_in" } },
        "hakuen.keycode.reveal": { ok: true, value: { code: "482913", validUntil: "2026-10-26T12:00:00+07:00" } },
        ...answers,
    }
    gateway.call.mockImplementation((_caller, name: string) =>
        Promise.resolve(defaults[name] ?? { ok: false, code: "unavailable", detail: "x" }),
    )
    const messages = mock<AgentMessagesService>()
    messages.storeAgentMessage.mockResolvedValue("m1")
    const channels = mock<ChannelDeliveryService>()
    channels.deliver.mockResolvedValue({ delivered: true, failure: null })
    const performer = new EarlyCheckinPerformerService(entityManager, catalog, clock, gateway, messages, channels)
    return { performer, entityManager, gateway, messages, channels }
}

const stayNotFound = (room: string) =>
    new WorkPerformersError({ code: WorkPerformersErrorCode.StayNotFound, params: { room } })

describe("EarlyCheckinPerformerService", () => {
    it("reads the room a front-desk line names", () => {
        expect(roomOfText("@ai-cskh phòng 302 khách xin nhận sớm")).toBe("302")
        expect(roomOfText("P.1205 early please")).toBe("1205")
        expect(roomOfText("khách xin nhận sớm")).toBeNull()
    })

    it("reads the stay of the room and the guest's linked conversation for the front desk to approve", async () => {
        const { performer, entityManager, gateway } = build()
        const prepared = await performer.prepare(CTX, itemOf(ASKED))
        expect(prepared.proposal.fields).toMatchObject({
            room: "302",
            stay_id: "s302",
            customer: "Lan",
            conversation_id: "c1",
            agent_id: "care",
        })
        expect(gateway.call.mock.calls[0]?.slice(1)).toEqual(["hakuen.stay.current", { room: "302" }])
        expect(entityManager.query).toHaveBeenCalledWith(FIND_LINKED_CONVERSATION, ["ws", "g1"])
    })

    it("refuses a request without a room, without a care agent or without a stay", async () => {
        const noRoom: Proposal = { summary: "khách xin nhận sớm", draft: "", fields: {} }
        await expect(build().performer.prepare(CTX, itemOf(noRoom))).rejects.toEqual(stayNotFound(""))
        const noCare = build()
        noCare.gateway.agentsGranted.mockResolvedValue([])
        await expect(noCare.performer.prepare(CTX, itemOf(ASKED))).rejects.toEqual(stayNotFound("302"))
        const noStay = build({ "hakuen.stay.current": { ok: true, value: { found: false } } })
        await expect(noStay.performer.prepare(CTX, itemOf(ASKED))).rejects.toEqual(stayNotFound("302"))
        const down = build({ "hakuen.stay.current": { ok: false, code: "unavailable", detail: "x" } })
        await expect(down.performer.prepare(CTX, itemOf(ASKED))).rejects.toEqual(stayNotFound("302"))
    })

    it("refuses a guest NIVO has no conversation with", async () => {
        const unreachable = new WorkPerformersError({
            code: WorkPerformersErrorCode.GuestUnreachable,
            params: { room: "302" },
        })
        const bare = build({ "hakuen.stay.current": { ok: true, value: { stay: { stayId: 3 } } } }, [])
        await expect(bare.performer.prepare(CTX, itemOf(ASKED))).rejects.toEqual(unreachable)
        expect(bare.entityManager.query).toHaveBeenCalledWith(FIND_LINKED_CONVERSATION, ["ws", ""])
    })

    it("checks in early, reveals the code as approved and sends it only to the guest, storing it masked", async () => {
        const { performer, gateway, messages, channels } = build()
        const { proposal } = await performer.prepare(CTX, itemOf(ASKED))
        const performed = await performer.perform(CTX, itemOf(proposal), proposal, { name: "Lễ tân A", kind: "staff" })
        expect(performed).toEqual({
            summary: 'gatewayTurns.earlyDone {"room":"302"}',
            evidence: "captured",
            lead_id: null,
            detail: null,
        })
        const calls = gateway.call.mock.calls.slice(1)
        expect(calls.map((call) => [call[1], call[2], call[0].approvedBy])).toEqual([
            ["hakuen.stay.checkIn", { stayId: "s302", earlyAt: "2026-10-24T03:00:00.000Z" }, "Lễ tân A"],
            ["hakuen.keycode.reveal", { stayId: "s302" }, "Lễ tân A"],
        ])
        expect(messages.storeAgentMessage).toHaveBeenCalledWith("ws", "c1", 'gatewayTurns.keyStored {"room":"302"}')
        expect(JSON.stringify(messages.storeAgentMessage.mock.calls)).not.toContain("482913")
        expect(channels.deliver.mock.calls[0]?.[0].text).toContain("482913")
        expect(channels.deliver.mock.calls[0]?.[0]).toMatchObject({ conversationId: "c1", messageId: "m1" })
    })

    it("performs an item whose fields are missing with empty values", async () => {
        const { performer, gateway } = build()
        const bare: Proposal = { summary: "x", fields: { room: 302 } }
        await expect(performer.perform(CTX, itemOf(bare), bare, { name: "Lễ tân A" })).resolves.toMatchObject({
            evidence: "captured",
        })
        expect(gateway.call.mock.calls[0]?.[2]).toMatchObject({ stayId: "" })
    })

    it("fails when HAKUEN refuses the check-in or the code, and sends nothing", async () => {
        for (const tool of ["hakuen.stay.checkIn", "hakuen.keycode.reveal"]) {
            const { performer, channels } = build({ [tool]: { ok: false, code: "tool_error", detail: "not allowed" } })
            await expect(performer.perform(CTX, itemOf(ASKED), ASKED, { name: "Lễ tân A" })).rejects.toBeInstanceOf(
                WorkPerformersError,
            )
            expect(channels.deliver).not.toHaveBeenCalled()
        }
    })
})
