import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundConnection } from "@modules/domain/agent-connections"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { OfficeLog } from "@modules/domain/module-ops"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    INSERT_NOTIFICATION,
    SELECT_AGENT_HANDLES,
    SELECT_HANDLE_STAFF,
    SELECT_NOTIFY_PERSON,
    SELECT_SHIFTS_AGENT,
} from "./persistence/shifts-alerts.sql"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsTextService } from "./shifts-text.service"

interface Person {
    readonly telegram?: string | null
    readonly zalo?: string | null
    readonly staffRow?: string | null
}

const connection = (provider: string): BoundConnection => ({
    id: `conn-${provider}`,
    provider,
    name: provider,
    botUsername: null,
    accountMasked: null,
    status: "connected",
    access: "auto",
    purpose: "outbound_chat",
})

const answer = (em: MockEntityManager, person: Person | null, agent: boolean) => {
    em.query.mockImplementation((sql: string) => {
        if (sql === SELECT_NOTIFY_PERSON)
            return Promise.resolve(
                person === null
                    ? []
                    : [
                          {
                              id: "p-1",
                              name: "Lan",
                              staff_id: person.staffRow ?? null,
                              telegram_chat_id: person.telegram ?? null,
                              zalo_user_id: person.zalo ?? null,
                          },
                      ],
            )
        if (sql === SELECT_HANDLE_STAFF) return Promise.resolve([{ id: "row-1", name: "Chi Lan" }])
        if (sql === SELECT_AGENT_HANDLES) return Promise.resolve([{ handle: "sales" }])
        if (sql === SELECT_SHIFTS_AGENT) return Promise.resolve(agent ? [{ id: "agent-1" }] : [])
        return Promise.resolve([])
    })
}

const build = async (em: MockEntityManager) => {
    const office = mock<OfficeLog>({ postOffice: () => Promise.resolve() })
    const bindings = mock<AgentBindingsService>()
    const delivery = mock<ChannelDeliveryService>({ sendToPerson: () => Promise.resolve() })
    const words = mock<ShiftsTextService>({ text: (key: string) => key })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsNotifyService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: OfficeLog, useValue: office },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: ChannelDeliveryService, useValue: delivery },
            { provide: ShiftsTextService, useValue: words },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsNotifyService), office, bindings, delivery }
}

const recorded = (em: MockEntityManager): Array<ReadonlyArray<unknown>> =>
    em.query.mock.calls.filter(([sql]) => sql === INSERT_NOTIFICATION).map(([, params]) => params ?? [])

describe("ShiftsNotifyService", () => {
    describe("toStaff", () => {
        it("tags the person in Office and records the line", async () => {
            const em = mockEntityManager()
            answer(em, { staffRow: "row-1" }, false)
            const { service, office } = await build(em)

            await expect(
                service.toStaff("ws-1", { staffId: "p-1", kind: "publish", body: "Your week", scheduleId: "sch-1" }),
            ).resolves.toEqual({ office: true, telegram: null, zalo: null })

            expect(office.postOffice).toHaveBeenCalledWith("ws-1", "@lan Your week")
            expect(recorded(em)).toEqual([
                ["ws-1", "p-1", "sch-1", null, "publish", "office", "sent", "@lan Your week", null],
            ])
        })

        it("sends on Telegram and Zalo through the connections bound to the shifts agent", async () => {
            const em = mockEntityManager()
            answer(em, { telegram: "chat-9", zalo: "zu-9" }, true)
            const { service, bindings, delivery } = await build(em)
            bindings.connectionsFor.mockImplementation((_agent, _purpose, options) =>
                Promise.resolve([connection(options?.providers?.[0] ?? "")]),
            )

            await expect(
                service.toStaff("ws-1", { staffId: "p-1", kind: "reminder", body: "Shift soon" }),
            ).resolves.toEqual({
                office: true,
                telegram: true,
                zalo: true,
            })

            expect(delivery.sendToPerson.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        connectionId: "conn-telegram",
                        provider: "telegram",
                        recipientId: "chat-9",
                        text: "Shift soon",
                    },
                ],
                [
                    {
                        workspaceId: "ws-1",
                        connectionId: "conn-zalo_oa",
                        provider: "zalo_oa",
                        recipientId: "zu-9",
                        text: "Shift soon",
                    },
                ],
            ])
            expect(recorded(em).map((row) => [row[5], row[6]])).toEqual([
                ["office", "sent"],
                ["telegram", "sent"],
                ["zalo", "sent"],
            ])
        })

        it("records a channel as skipped when nothing is bound and as failed when the send fails", async () => {
            const em = mockEntityManager()
            answer(em, { telegram: "chat-9", zalo: "zu-9" }, true)
            const { service, bindings, delivery } = await build(em)
            bindings.connectionsFor.mockImplementation((_agent, _purpose, options) =>
                Promise.resolve(options?.providers?.[0] === "telegram" ? [connection("telegram")] : []),
            )
            delivery.sendToPerson.mockRejectedValue(new Error("bot blocked"))

            await expect(service.toStaff("ws-1", { staffId: "p-1", kind: "swap", body: "Swapped" })).resolves.toEqual({
                office: true,
                telegram: false,
                zalo: null,
            })

            expect(recorded(em).map((row) => [row[5], row[6], row[8]])).toEqual([
                ["office", "sent", null],
                ["telegram", "failed", "bot blocked"],
                ["zalo", "skipped", "shifts.channelNotBound"],
            ])
        })

        it("does nothing for an unknown person", async () => {
            const em = mockEntityManager()
            answer(em, null, false)
            const { service, office } = await build(em)

            await expect(service.toStaff("ws-1", { staffId: "p-x", kind: "leave", body: "x" })).resolves.toEqual({
                office: false,
                telegram: null,
                zalo: null,
            })
            expect(office.postOffice).not.toHaveBeenCalled()
        })

        it("records a failed Office line without throwing", async () => {
            const em = mockEntityManager()
            answer(em, {}, false)
            const { service, office } = await build(em)
            office.postOffice.mockRejectedValue(new Error("office down"))

            await expect(service.toStaff("ws-1", { staffId: "p-1", kind: "leave", body: "Leave ok" })).resolves.toEqual(
                {
                    office: false,
                    telegram: null,
                    zalo: null,
                },
            )
            expect(recorded(em)[0]?.slice(5)).toEqual(["office", "failed", "shifts.tagged", "office down"])
        })
    })

    describe("toManagers", () => {
        it("posts one Office line and records it under its kind", async () => {
            const em = mockEntityManager()
            answer(em, null, false)
            const { service, office } = await build(em)

            await service.toManagers("ws-1", "Nobody checked in", "no_show", { shiftId: "s-1" })

            expect(office.postOffice).toHaveBeenCalledWith("ws-1", "Nobody checked in")
            expect(recorded(em)).toEqual([
                ["ws-1", null, null, "s-1", "no_show", "office", "sent", "Nobody checked in", null],
            ])
        })
    })

    describe("hasChannel", () => {
        it("is false without an active shifts agent", async () => {
            const em = mockEntityManager()
            answer(em, null, false)
            const { service } = await build(em)

            await expect(service.hasChannel("ws-1")).resolves.toBe(false)
        })
    })
})
