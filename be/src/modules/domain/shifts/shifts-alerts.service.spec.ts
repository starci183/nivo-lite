import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ActionPerformerRegistry, ApprovalGate, OfficeLog } from "@modules/domain/module-ops"
import type { PerformContext } from "@modules/domain/module-ops"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { routedQueryBuilder } from "@tests/fixtures/builders/routed-query.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { AlertShiftRead, ReminderWorkspaceRead } from "./persistence/shifts-alerts.reads"
import { DEFAULT_SETTINGS } from "./policies/row-mappers.policy"
import { ShiftsAlertsService } from "./shifts-alerts.service"
import type { Setup } from "./shifts.contracts"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsMonthCloseService } from "./shifts-month-close.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsTextService } from "./shifts-text.service"
import { ShiftsLogEvent } from "./shifts.log-events"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** A substring matcher, typed `unknown` so it flows into any slot. */
const stringLike = (text: string): unknown => expect.stringContaining(text)

/** The match-anything matcher, typed `unknown` so it flows into any slot. */
const anything = (): unknown => expect.anything()

/** 07:00 in Vietnam on 2026-10-14: one hour before the 08:00 shift. */
const NOW = "2026-10-14T00:00:00.000Z"

const row = (flags: Partial<AlertShiftRead> = {}): AlertShiftRead => ({
    id: "s-1",
    schedule_id: "sch-1",
    shift_date: "2026-10-14",
    start_time: "08:00:00",
    end_time: "12:00:00",
    position_id: "pos-1",
    staff_id: "p-1",
    status: "published",
    checked_in: false,
    reminded: false,
    alerted: false,
    ...flags,
})

const SETUP: Setup = {
    positions: [{ id: "pos-1", name: "Barista", color: "#000" }],
    staff: [
        {
            id: "p-1",
            name: "Lan",
            positionIds: ["pos-1"],
            skills: [],
            wage: 0,
            maxWeek: 48,
            maxDay: 10,
            minRest: 8,
            staffRowId: null,
            telegramChatId: null,
            zaloUserId: null,
            phone: null,
            active: true,
        },
    ],
    blocks: [],
    settings: DEFAULT_SETTINGS,
}

const WORKSPACE: ReminderWorkspaceRead = { workspace_id: "ws-1", config: null, remind_minutes: 60, noshow_minutes: 10 }

/** What the reads of the service answer. */
interface Answers {
    /** The workspaces whose reminders are on. */
    readonly workspaces?: ReadonlyArray<ReminderWorkspaceRead>
    /** The names of the others on duty; Minh by default. */
    readonly mates?: ReadonlyArray<{ readonly name: string }>
    /** The workspace whose shift read fails. */
    readonly failFor?: string
}

const fromOf = (fake: FakeQueryBuilder): unknown => fake.callsOf("from")[0]?.[0]

/** Hands out one fake builder per read, answering by the table it reads, and answers back every builder it made. */
const answer = (
    em: MockEntityManager,
    rows: ReadonlyArray<AlertShiftRead>,
    enabled: boolean | null = true,
    options: Answers = {},
): Array<FakeQueryBuilder> => {
    const built: Array<FakeQueryBuilder> = []
    em.createQueryBuilder.mockImplementation(() => {
        const fake: FakeQueryBuilder = routedQueryBuilder({
            getRawMany: (read) => {
                if (fromOf(read) === "public.automation_pipelines") {
                    return Promise.resolve(options.workspaces ?? [WORKSPACE])
                }
                if (read.callsOf("distinct").length > 0) return Promise.resolve(options.mates ?? [{ name: "Minh" }])
                const where = read.callsOf("where")[0]?.[1] as { workspaceId?: string } | undefined
                if (where?.workspaceId !== undefined && where.workspaceId === options.failFor) {
                    return Promise.reject(new TypeError("workspace query failed"))
                }
                return Promise.resolve(rows)
            },
            getRawOne: (read) =>
                Promise.resolve(
                    fromOf(read) === "public.automation_pipelines"
                        ? enabled === null
                            ? undefined
                            : { enabled }
                        : rows[0],
                ),
        })
        built.push(fake)
        return fake.builder as never
    })
    return built
}

const build = async (em: MockEntityManager, now = NOW) => {
    const outbox = recordingQueueOutbox()
    const registry = mock<ActionPerformerRegistry>()
    const gate = mock<ApprovalGate>()
    gate.request.mockResolvedValue({ status: "done", workItemId: "wi-1" })
    const office = mock<OfficeLog>()
    office.logEvidence.mockResolvedValue(undefined)
    const workspaces = mock<WorkspacesService>()
    workspaces.nameOf.mockResolvedValue("Spa")
    const data = mock<ShiftsDataService>({ loadSetup: () => Promise.resolve(SETUP) })
    const monthClose = mock<ShiftsMonthCloseService>()
    monthClose.tick.mockResolvedValue(0)
    const logger = mock<Logger>()
    const notify = mock<ShiftsNotifyService>()
    notify.toStaff.mockResolvedValue({ office: true, telegram: true, zalo: null })
    notify.toManagers.mockResolvedValue(undefined)
    const words = mock<ShiftsTextService>({
        text: (key: string, params?: Record<string, string | number>) =>
            `${key}${params ? JSON.stringify(params) : ""}`,
        line: () => "line",
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsAlertsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(now) },
            { provide: ActionPerformerRegistry, useValue: registry },
            { provide: ApprovalGate, useValue: gate },
            { provide: OfficeLog, useValue: office },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsMonthCloseService, useValue: monthClose },
            { provide: ShiftsNotifyService, useValue: notify },
            { provide: ShiftsTextService, useValue: words },
        ],
    }).compile()
    return {
        service: moduleRef.get(ShiftsAlertsService),
        outbox,
        registry,
        gate,
        office,
        monthClose,
        notify,
        logger,
        workspaces,
    }
}

const context = (fields: PerformContext["fields"]): PerformContext => ({
    workspaceId: "ws-1",
    workItemId: "wi-1",
    actor: "NIVO",
    draft: null,
    fields,
})

describe("ShiftsAlertsService", () => {
    it("runs the registered performer and accepts rejection without sending a reminder", async () => {
        const em = mockEntityManager()
        answer(em, [])
        const { service, registry, notify } = await build(em)
        service.onModuleInit()
        const performer = registry.add.mock.calls[0]?.[0]

        expect(performer?.action).toBe("remind_shift")
        await expect(performer?.perform(context({ shift_id: "s-1" }))).resolves.toEqual({
            summary: "shifts.remindInactive",
            evidence: "pending",
        })
        await expect(performer?.reject?.(context({}))).resolves.toBeUndefined()
        expect(notify.toStaff).not.toHaveBeenCalled()
    })
})

describe("ShiftsAlertsService scan", () => {
    it("returns zero counts without opening a transaction when no alerts are due", async () => {
        const em = mockEntityManager()
        const built = answer(em, [row({ reminded: true, checked_in: true })])
        const { service, outbox } = await build(em)

        await expect(service.scan(new Date(NOW))).resolves.toEqual({ reminders: 0, noShows: 0 })
        expect(built.flatMap((fake) => fake.callsOf("andWhere"))).toContainEqual([
            "s.shift_date BETWEEN :first AND :last",
            { first: "2026-10-13", last: "2026-10-15" },
        ])
        expect(em.transaction).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })

    it("logs a failed workspace and queues both alert kinds for the next workspace", async () => {
        const em = fakeTransaction(mockEntityManager()).em
        const failure = new TypeError("workspace query failed")
        answer(
            em,
            [row({ id: "reminder", staff_id: null, start_time: "09:00:00" }), row({ id: "noshow", reminded: true })],
            true,
            {
                workspaces: [{ ...WORKSPACE, workspace_id: "failed" }, WORKSPACE],
                failFor: "failed",
            },
        )
        const { service, outbox, logger } = await build(em)
        const write = jest.spyOn(outbox, "write")

        await expect(service.scan(new Date("2026-10-14T01:15:00.000Z"))).resolves.toEqual({
            reminders: 1,
            noShows: 1,
        })
        expect(logger.error).toHaveBeenCalledWith(ShiftsLogEvent.AlertScanFailed, failure, {
            workspaceId: "failed",
        })
        expect(outbox.jobs).toEqual([
            { queue: "shifts_alerts", payload: { kind: "remind", workspaceId: "ws-1", shiftId: "reminder" } },
            { queue: "shifts_alerts", payload: { kind: "noshow", workspaceId: "ws-1", shiftId: "noshow" } },
        ])
        expect(outbox.allInTransaction).toBe(true)
        expect(write).toHaveBeenCalledWith(
            anything(),
            "shifts_alerts",
            { kind: "remind", workspaceId: "ws-1", shiftId: "reminder" },
            { job: "shifts.remind", dedupeKey: "shifts.remind:reminder:" },
        )
        expect(write).toHaveBeenCalledWith(
            anything(),
            "shifts_alerts",
            { kind: "noshow", workspaceId: "ws-1", shiftId: "noshow" },
            { job: "shifts.noshow", dedupeKey: "shifts.noshow:noshow:p-1" },
        )
    })
})

describe("ShiftsAlertsService", () => {
    it("registers the remind_shift performer", async () => {
        const { service, registry } = await build(mockEntityManager())

        service.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith(objectLike({ action: "remind_shift" }))
    })
})

describe("ShiftsAlertsService runJob", () => {
    it("on a tick queues the due reminder once per shift and person, then closes the month where due", async () => {
        const em = fakeTransaction(mockEntityManager()).em
        answer(em, [row()])
        const { service, outbox, monthClose } = await build(em)

        await service.runJob({ kind: "tick" })

        expect(outbox.jobsOf("shifts_alerts")).toEqual([
            { queue: "shifts_alerts", payload: { kind: "remind", workspaceId: "ws-1", shiftId: "s-1" } },
        ])
        expect(outbox.allInTransaction).toBe(true)
        expect(monthClose.tick).toHaveBeenCalledWith(new Date(NOW))
    })

    it("queues a no-show check after the delay", async () => {
        const em = fakeTransaction(mockEntityManager()).em
        answer(em, [row({ reminded: true })])
        const { service, outbox } = await build(em, "2026-10-14T01:15:00.000Z")

        await service.runJob({ kind: "tick" })

        expect(outbox.jobsOf("shifts_alerts")).toEqual([
            { queue: "shifts_alerts", payload: { kind: "noshow", workspaceId: "ws-1", shiftId: "s-1" } },
        ])
    })

    it("drops a foreign payload", async () => {
        const em = mockEntityManager()
        const { service, gate } = await build(em)

        await service.runJob({ commandId: "c-1" })

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(gate.request).not.toHaveBeenCalled()
    })

    it("asks the gate to remind the person of a queued shift", async () => {
        const em = mockEntityManager()
        answer(em, [row()])
        const { service, gate } = await build(em)

        await service.runJob({ kind: "remind", workspaceId: "ws-1", shiftId: "s-1" })

        expect(gate.request).toHaveBeenCalledWith(
            objectLike({
                action: "remind_shift",
                dedupeKey: "remind_shift:s-1:p-1",
                fields: { shift_id: "s-1", staff_id: "p-1" },
            }),
        )
    })

    it("tells the managers when nobody checked in", async () => {
        const em = mockEntityManager()
        answer(em, [row({ reminded: true })])
        const { service, notify, office } = await build(em, "2026-10-14T01:15:00.000Z")

        await service.runJob({ kind: "noshow", workspaceId: "ws-1", shiftId: "s-1" })

        expect(notify.toManagers).toHaveBeenCalledWith("ws-1", stringLike("shifts.noShowOffice"), "no_show", {
            shiftId: "s-1",
        })
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", objectLike({ kind: "shifts.no_show" }))
    })
})

describe("ShiftsAlertsService remind", () => {
    it("returns the gate verdict with the exact reminder request", async () => {
        const em = mockEntityManager()
        answer(em, [row()])
        const { service, gate } = await build(em)
        gate.request.mockResolvedValue({ status: "pending", workItemId: "wi-pending" })

        await expect(service.remind("ws-1", "s-1")).resolves.toBe("pending")
        expect(gate.request).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            actor: "NIVO",
            action: "remind_shift",
            subjectType: "shift",
            subjectId: "s-1",
            dedupeKey: "remind_shift:s-1:p-1",
            summary: 'shifts.remindAskSummary{"name":"Lan","line":"line"}',
            fields: { shift_id: "s-1", staff_id: "p-1" },
        })
    })

    it("skips an unassigned shift without asking the gate", async () => {
        const em = mockEntityManager()
        answer(em, [row({ staff_id: null })])
        const { service, gate } = await build(em)

        await expect(service.remind("ws-1", "s-1")).resolves.toBe("skipped: shift not active")
        expect(gate.request).not.toHaveBeenCalled()
    })

    it("skips when the automation is off, the shift is gone or the person was reminded", async () => {
        const off = mockEntityManager()
        answer(off, [row()], false)
        await expect((await build(off)).service.remind("ws-1", "s-1")).resolves.toBe("skipped: automation off")

        const gone = mockEntityManager()
        answer(gone, [])
        await expect((await build(gone)).service.remind("ws-1", "s-1")).resolves.toBe("skipped: shift not active")

        const done = mockEntityManager()
        answer(done, [row({ reminded: true })])
        await expect((await build(done)).service.remind("ws-1", "s-1")).resolves.toBe("skipped: already reminded")
    })
})

describe("ShiftsAlertsService noShow", () => {
    it.each([{ rows: [] }, { rows: [row({ staff_id: null })] }])("skips inactive shift rows %p", async ({ rows }) => {
        const em = mockEntityManager()
        answer(em, rows)
        const { service, notify, office } = await build(em)

        await expect(service.noShow("ws-1", "s-1", new Date(NOW))).resolves.toBe("skipped: shift not active")
        expect(notify.toManagers).not.toHaveBeenCalled()
        expect(office.logEvidence).not.toHaveBeenCalled()
    })

    it("skips when the enabled query has no row", async () => {
        const em = mockEntityManager()
        const built = answer(em, [], null)
        const { service, notify } = await build(em)

        await expect(service.noShow("ws-1", "s-1", new Date(NOW))).resolves.toBe("skipped: automation off")
        expect(built).toHaveLength(1)
        expect(built[0]?.callsOf("where")).toEqual([
            [
                "p.workspace_id = :workspaceId AND p.template_key = :template",
                { workspaceId: "ws-1", template: "shifts_shift_reminder" },
            ],
        ])
        expect(notify.toManagers).not.toHaveBeenCalled()
    })

    it("records the exact no-show notice and evidence", async () => {
        const em = mockEntityManager()
        answer(em, [row()])
        const { service, notify, office } = await build(em)

        await expect(service.noShow("ws-1", "s-1", new Date("2026-10-14T01:15:00.000Z"))).resolves.toBe("alerted")
        expect(notify.toManagers).toHaveBeenCalledWith(
            "ws-1",
            'shifts.noShowOffice{"name":"Lan","minutes":15,"line":"line"}',
            "no_show",
            { shiftId: "s-1" },
        )
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            kind: "shifts.no_show",
            actor: "NIVO",
            summary: 'shifts.noShowEvidence{"name":"Lan","start":"08:00","end":"12:00","date":"2026-10-14"}',
            evidence: "s-1",
        })
    })

    it.each([
        ["a checked-in person", row({ checked_in: true }), "2026-10-14T01:15:00.000Z", "checked in"],
        ["an alert already sent", row({ alerted: true }), "2026-10-14T01:15:00.000Z", "already alerted"],
        ["a shift that is over", row(), "2026-10-14T05:00:00.000Z", "skipped: shift is over"],
    ])("sends nothing for %s", async (_name, shift, now, verdict) => {
        const em = mockEntityManager()
        answer(em, [shift])
        const { service, notify } = await build(em, now)

        await expect(service.noShow("ws-1", "s-1", new Date(now))).resolves.toBe(verdict)
        expect(notify.toManagers).not.toHaveBeenCalled()
    })
})

describe("ShiftsAlertsService performRemind", () => {
    it.each([
        { telegram: false, zalo: true, key: "shifts.remindDoneZalo" },
        { telegram: null, zalo: null, key: "shifts.remindDoneOffice" },
    ])("uses fallback labels and reports delivery %p", async ({ telegram, zalo, key }) => {
        const em = mockEntityManager()
        const built = answer(em, [row({ position_id: "missing" })], true, { mates: [] })
        const { service, notify, workspaces } = await build(em)
        workspaces.nameOf.mockResolvedValue("")
        notify.toStaff.mockResolvedValue({ office: true, telegram, zalo })

        await expect(service.performRemind(context({ shift_id: "s-1" }))).resolves.toEqual({
            summary: `${key}{"name":"Lan","start":"08:00","end":"12:00"}`,
            evidence: "captured",
        })
        expect(notify.toStaff).toHaveBeenCalledWith("ws-1", {
            staffId: "p-1",
            kind: "reminder",
            shiftId: "s-1",
            workItemId: "wi-1",
            body: `shifts.remindBody${JSON.stringify({
                position: "shifts.remindPosition",
                start: "08:00",
                end: "12:00",
                shop: "shifts.remindShop",
                mates: "",
            })}`,
        })
        expect(built.flatMap((fake) => fake.callsOf("where"))).toContainEqual([
            expect.stringContaining("s.staff_id <> :personId"),
            { workspaceId: "ws-1", day: "2026-10-14", personId: "p-1" },
        ])
        expect(workspaces.nameOf).toHaveBeenCalledWith("ws-1")
    })

    it("returns a pending result for a person removed from setup", async () => {
        const em = mockEntityManager()
        answer(em, [row({ staff_id: "removed" })])
        const { service, notify } = await build(em)

        await expect(service.performRemind(context({ shift_id: "s-1" }))).resolves.toEqual({
            summary: "shifts.remindNoPerson",
            evidence: "pending",
        })
        expect(notify.toStaff).not.toHaveBeenCalled()
    })

    it.each<PerformContext["fields"]>([{}, { shift_id: "s-1" }])(
        "does not send an unassigned reminder for fields %p",
        async (fields) => {
            const em = mockEntityManager()
            answer(em, [row({ staff_id: null })])
            const { service, notify } = await build(em)

            await expect(service.performRemind(context(fields))).resolves.toEqual({
                summary: "shifts.remindInactive",
                evidence: "pending",
            })
            expect(notify.toStaff).not.toHaveBeenCalled()
        },
    )

    it("reminds the person with the others on duty and says where it went", async () => {
        const em = mockEntityManager()
        answer(em, [row()])
        const { service, notify } = await build(em)

        const result = await service.performRemind(context({ shift_id: "s-1", staff_id: "p-1" }))

        expect(notify.toStaff).toHaveBeenCalledWith(
            "ws-1",
            objectLike({ staffId: "p-1", kind: "reminder", shiftId: "s-1", workItemId: "wi-1" }),
        )
        expect(result).toEqual({
            summary: stringLike("shifts.remindDoneTelegram"),
            evidence: "captured",
        })
    })
})

describe("ShiftsAlertsService performRemind", () => {
    it("reminds nobody for a shift that is no longer active", async () => {
        const em = mockEntityManager()
        answer(em, [])
        const { service, notify } = await build(em)

        await expect(service.performRemind(context({ shift_id: "s-1" }))).resolves.toEqual({
            summary: "shifts.remindInactive",
            evidence: "pending",
        })
        expect(notify.toStaff).not.toHaveBeenCalled()
    })
})
