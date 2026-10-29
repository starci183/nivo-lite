import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundConnection } from "@modules/domain/agent-connections"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { OfficeLog } from "@modules/domain/module-ops"
import { StaffEntity } from "@modules/domain/staff"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ShiftsNotificationEntity, ShiftsStaffEntity } from "./persistence/entities"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsTextService } from "./shifts-text.service"
import { ShiftsLogEvent } from "./shifts.log-events"

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

const personOf = entityOf(ShiftsStaffEntity, {
    id: "p-1",
    name: "Lan",
    staffId: null,
    telegramChatId: null,
    zaloUserId: null,
})

const answer = (person: Person | null, agent: boolean): MockEntityManager => {
    const em = mockEntityManager({
        findOne: [
            ShiftsStaffEntity,
            person === null
                ? null
                : personOf({
                      staffId: person.staffRow ?? null,
                      telegramChatId: person.telegram ?? null,
                      zaloUserId: person.zalo ?? null,
                  }),
        ],
        find: [StaffEntity, [entityOf(StaffEntity, { id: "row-1", name: "Chi Lan" })()]],
        insert: [ShiftsNotificationEntity, {}],
    })
    em.createQueryBuilder.mockReturnValue(
        fakeQueryBuilder({ getRawOne: agent ? { id: "agent-1" } : undefined, getRawMany: [{ handle: "sales" }] })
            .builder as never,
    )
    return em
}

const build = async (em: MockEntityManager) => {
    const office = mock<OfficeLog>()
    office.postOffice.mockResolvedValue(undefined)
    const bindings = mock<AgentBindingsService>()
    const delivery = mock<ChannelDeliveryService>()
    delivery.sendToPerson.mockResolvedValue(undefined)
    const words = mock<ShiftsTextService>()
    words.text.mockImplementation((key: string) => key)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsNotifyService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
            { provide: OfficeLog, useValue: office },
            { provide: AgentBindingsService, useValue: bindings },
            { provide: ChannelDeliveryService, useValue: delivery },
            { provide: ShiftsTextService, useValue: words },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsNotifyService), office, bindings, delivery, logger, words }
}

const recorded = (em: MockEntityManager): Array<ReadonlyArray<unknown>> =>
    em.insert.mock.calls
        .filter(([entity]) => entity === ShiftsNotificationEntity)
        .map(([, row]): ReadonlyArray<unknown> => {
            const note = row as Partial<ShiftsNotificationEntity>
            return [
                note.workspaceId,
                note.staffId,
                note.scheduleId,
                note.shiftId,
                note.kind,
                note.channel,
                note.status,
                note.body,
                note.error,
            ]
        })

describe("ShiftsNotifyService toStaff", () => {
    it("tags the person in Office and records the line", async () => {
        const em = answer({ staffRow: "row-1" }, false)
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
        const em = answer({ telegram: "chat-9", zalo: "zu-9" }, true)
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
})

describe("ShiftsNotifyService toStaff", () => {
    it("records a channel as skipped when nothing is bound and as failed when the send fails", async () => {
        const em = answer({ telegram: "chat-9", zalo: "zu-9" }, true)
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
        const em = answer(null, false)
        const { service, office } = await build(em)

        await expect(service.toStaff("ws-1", { staffId: "p-x", kind: "leave", body: "x" })).resolves.toEqual({
            office: false,
            telegram: null,
            zalo: null,
        })
        expect(office.postOffice).not.toHaveBeenCalled()
    })

    it("records a failed Office line without throwing", async () => {
        const em = answer({}, false)
        const { service, office } = await build(em)
        office.postOffice.mockRejectedValue(new Error("office down"))

        await expect(service.toStaff("ws-1", { staffId: "p-1", kind: "leave", body: "Leave ok" })).resolves.toEqual({
            office: false,
            telegram: null,
            zalo: null,
        })
        expect(recorded(em)[0]?.slice(5)).toEqual(["office", "failed", "shifts.tagged", "office down"])
    })

    it("uses the person's name when the linked staff row is missing and ignores empty channel ids", async () => {
        const em = answer({ staffRow: "missing", telegram: "", zalo: "" }, true)
        const { service, office, words, bindings, delivery } = await build(em)

        await expect(service.toStaff("ws-1", { staffId: "p-1", kind: "publish", body: "Week ready" })).resolves.toEqual(
            {
                office: true,
                telegram: null,
                zalo: null,
            },
        )

        expect(words.text).toHaveBeenCalledWith("shifts.tagged", { name: "Lan", body: "Week ready" })
        expect(office.postOffice).toHaveBeenCalledWith("ws-1", "shifts.tagged")
        expect(bindings.connectionsFor).not.toHaveBeenCalled()
        expect(delivery.sendToPerson).not.toHaveBeenCalled()
        expect(recorded(em)).toEqual([["ws-1", "p-1", null, null, "publish", "office", "sent", "shifts.tagged", null]])
    })
})

describe("ShiftsNotifyService toStaff", () => {
    it("skips both linked channels when there is no shifts agent", async () => {
        const em = answer({ telegram: "chat-9", zalo: "zu-9" }, false)
        const { service, delivery } = await build(em)

        await expect(service.toStaff("ws-1", { staffId: "p-1", kind: "gap", body: "Open shift" })).resolves.toEqual({
            office: true,
            telegram: null,
            zalo: null,
        })

        expect(delivery.sendToPerson).not.toHaveBeenCalled()
        expect(recorded(em)).toEqual([
            ["ws-1", "p-1", null, null, "gap", "office", "sent", "shifts.tagged", null],
            ["ws-1", "p-1", null, null, "gap", "telegram", "skipped", "Open shift", "shifts.channelNotBound"],
            ["ws-1", "p-1", null, null, "gap", "zalo", "skipped", "Open shift", "shifts.channelNotBound"],
        ])
    })

    it("caps non-Error Office failures and keeps sending through both channels", async () => {
        const em = answer({ telegram: "chat-9", zalo: "zu-9" }, true)
        const { service, office, bindings, delivery, logger } = await build(em)
        const cause = "x".repeat(240)
        office.postOffice.mockRejectedValue(cause)
        bindings.connectionsFor.mockImplementation((_agent, _purpose, options) =>
            Promise.resolve([connection(options?.providers?.[0] ?? "")]),
        )
        delivery.sendToPerson.mockRejectedValue("channel unavailable")

        await expect(service.toStaff("ws-1", { staffId: "p-1", kind: "no_show", body: "Check in" })).resolves.toEqual({
            office: false,
            telegram: false,
            zalo: false,
        })

        expect(recorded(em).map((row) => [row[5], row[6], row[8]])).toEqual([
            ["office", "failed", "x".repeat(200)],
            ["telegram", "failed", "channel unavailable"],
            ["zalo", "failed", "channel unavailable"],
        ])
        expect(logger.error.mock.calls).toEqual([
            [ShiftsLogEvent.NoticeFailed, "channel unavailable", { workspaceId: "ws-1", provider: "telegram" }],
            [ShiftsLogEvent.NoticeFailed, "channel unavailable", { workspaceId: "ws-1", provider: "zalo_oa" }],
        ])
    })
})

describe("ShiftsNotifyService toManagers", () => {
    it("posts one Office line and records it under its kind", async () => {
        const em = answer(null, false)
        const { service, office } = await build(em)

        await service.toManagers("ws-1", "Nobody checked in", "no_show", { shiftId: "s-1" })

        expect(office.postOffice).toHaveBeenCalledWith("ws-1", "Nobody checked in")
        expect(recorded(em)).toEqual([
            ["ws-1", null, null, "s-1", "no_show", "office", "sent", "Nobody checked in", null],
        ])
    })

    it("defaults to a gap alert and logs a failed evidence insert", async () => {
        const em = answer(null, false)
        const cause = new Error("evidence unavailable")
        em.insert.mockRejectedValue(cause)
        const { service, office, logger } = await build(em)

        await expect(service.toManagers("ws-1", "Open shift")).resolves.toBeUndefined()

        expect(office.postOffice).toHaveBeenCalledWith("ws-1", "Open shift")
        expect(recorded(em)).toEqual([["ws-1", null, null, null, "gap", "office", "sent", "Open shift", null]])
        expect(logger.error).toHaveBeenCalledWith(ShiftsLogEvent.NoticeNotRecorded, cause, {
            workspaceId: "ws-1",
            channel: "office",
        })
    })
})

describe("ShiftsNotifyService evidence length", () => {
    it("keeps at most 4000 characters of the line", async () => {
        const em = answer(null, false)
        const { service } = await build(em)

        await service.toManagers("ws-1", "m".repeat(4100))

        expect(em.insert).toHaveBeenCalledWith(
            ShiftsNotificationEntity,
            expect.objectContaining({ channel: "office", status: "sent", body: "m".repeat(4000), error: null }),
        )
    })
})

describe("ShiftsNotifyService hasChannel", () => {
    it("is false without an active shifts agent", async () => {
        const em = answer(null, false)
        const { service } = await build(em)

        await expect(service.hasChannel("ws-1")).resolves.toBe(false)
    })

    it("stops searching once Telegram has a bound connection", async () => {
        const em = answer(null, true)
        const { service, bindings } = await build(em)
        bindings.connectionsFor.mockResolvedValue([connection("telegram")])

        await expect(service.hasChannel("ws-1")).resolves.toBe(true)

        expect(bindings.connectionsFor.mock.calls).toEqual([
            [
                "agent-1",
                "outbound_chat",
                {
                    acting: true,
                    connectedOnly: true,
                    providers: ["telegram"],
                },
            ],
        ])
    })

    it("uses a Zalo binding when Telegram has none", async () => {
        const em = answer(null, true)
        const { service, bindings } = await build(em)
        bindings.connectionsFor.mockResolvedValueOnce([]).mockResolvedValueOnce([connection("zalo_oa")])

        await expect(service.hasChannel("ws-1")).resolves.toBe(true)

        expect(bindings.connectionsFor.mock.calls).toEqual([
            ["agent-1", "outbound_chat", { acting: true, connectedOnly: true, providers: ["telegram"] }],
            ["agent-1", "outbound_chat", { acting: true, connectedOnly: true, providers: ["zalo_oa"] }],
        ])
    })
})
