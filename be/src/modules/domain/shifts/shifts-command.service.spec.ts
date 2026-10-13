import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ShiftsError, ShiftsErrorCode } from "./errors/shifts.error"
import { FINISH_COMMAND, SELECT_COMMAND } from "./persistence/shifts.sql"
import type { ShiftsCommandsRow } from "./persistence/shifts.rows"
import { ShiftsCommandService } from "./shifts-command.service"
import { ShiftsImportService } from "./shifts-import.service"
import { ShiftsRequestsService } from "./shifts-requests.service"
import { ShiftsScheduleService } from "./shifts-schedule.service"
import { ShiftsLogEvent } from "./shifts.log-events"

class MembershipError extends DomainError<"MEMBERSHIP_FORBIDDEN"> {}

const commandRow = (kind: string, input: unknown, status = "queued"): ShiftsCommandsRow => ({
    id: "command-1",
    workspace_id: "ws-1",
    kind,
    input,
    status,
    created_by: "user-1",
})

const queuedCommand = (kind: string, input: unknown, status = "queued") =>
    mockEntityManager({
        query: [
            [SELECT_COMMAND, [commandRow(kind, input, status)]],
            [FINISH_COMMAND, []],
        ],
    })

const build = async (entityManager: MockEntityManager) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params = {}) => `${key}${JSON.stringify(params)}`)
    const logger = mock<Logger>()
    const schedule = mock<ShiftsScheduleService>()
    const requests = mock<ShiftsRequestsService>()
    const importing = mock<ShiftsImportService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsCommandService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LOGGER, useValue: logger },
            { provide: ShiftsScheduleService, useValue: schedule },
            { provide: ShiftsRequestsService, useValue: requests },
            { provide: ShiftsImportService, useValue: importing },
        ],
    }).compile()
    return {
        service: moduleRef.get(ShiftsCommandService),
        catalog,
        logger,
        schedule,
        requests,
        importing,
        effects: [
            schedule.proposeWeek,
            schedule.explainSchedule,
            schedule.reassignShift,
            schedule.addDraftShift,
            schedule.removeDraftShift,
            schedule.requestPublish,
            requests.requestSwap,
            requests.requestLeave,
            importing.applyImport,
        ],
    }
}

const expectDone = (entityManager: MockEntityManager, result: string | null) => {
    expect(entityManager.query.mock.calls).toEqual([
        [SELECT_COMMAND, ["command-1", "ws-1"]],
        [FINISH_COMMAND, ["command-1", "done", result, null, null]],
    ])
}

const expectFailed = (entityManager: MockEntityManager, code: string, message: string) => {
    expect(entityManager.query.mock.calls).toEqual([
        [SELECT_COMMAND, ["command-1", "ws-1"]],
        [FINISH_COMMAND, ["command-1", "failed", null, code, message]],
    ])
}

describe("ShiftsCommandService", () => {
    describe("run", () => {
        it("leaves an unknown command unchanged", async () => {
            const em = mockEntityManager({ query: [SELECT_COMMAND, []] })
            const { service, effects } = await build(em)

            await service.run("command-1", "ws-1")

            expect(em.query.mock.calls).toEqual([[SELECT_COMMAND, ["command-1", "ws-1"]]])
            for (const effect of effects) expect(effect).not.toHaveBeenCalled()
        })

        it.each(["done", "failed"])("leaves a command already settled as %s unchanged", async (status) => {
            const em = queuedCommand("propose-week", { week: "2026-10-12" }, status)
            const { service, effects } = await build(em)

            await service.run("command-1", "ws-1")

            expect(em.query.mock.calls).toEqual([[SELECT_COMMAND, ["command-1", "ws-1"]]])
            for (const effect of effects) expect(effect).not.toHaveBeenCalled()
        })

        it("proposes a week as the submitting member and stores the report", async () => {
            const input = { week: "2026-10-12" }
            const em = queuedCommand("propose-week", input)
            const { service, schedule } = await build(em)
            schedule.proposeWeek.mockResolvedValue({
                scheduleId: "schedule-1",
                version: 2,
                shifts: 3,
                open: 1,
                short: 2,
                costVnd: 240000,
            })

            await service.run("command-1", "ws-1")

            expect(schedule.proposeWeek.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"scheduleId":"schedule-1","version":2,"shifts":3,"open":1,"short":2,"costVnd":240000}`)
        })

        it("explains a schedule and stores its text", async () => {
            const input = { scheduleId: "schedule-1" }
            const em = queuedCommand("explain-schedule", input)
            const { service, schedule } = await build(em)
            schedule.explainSchedule.mockResolvedValue({ explanation: "Two open shifts" })

            await service.run("command-1", "ws-1")

            expect(schedule.explainSchedule.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"explanation":"Two open shifts"}`)
        })

        it("reassigns a shift and settles with a null result", async () => {
            const input = { shiftId: "shift-1", staffId: "staff-2" }
            const em = queuedCommand("reassign-shift", input)
            const { service, schedule } = await build(em)
            schedule.reassignShift.mockResolvedValue(undefined)

            await service.run("command-1", "ws-1")

            expect(schedule.reassignShift.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, null)
        })

        it("adds an open draft shift and settles with a null result", async () => {
            const input = {
                scheduleId: "schedule-1",
                date: "2026-10-12",
                start: "07:00",
                end: "11:00",
                positionId: "position-1",
                staffId: null,
            }
            const em = queuedCommand("add-draft-shift", input)
            const { service, schedule } = await build(em)
            schedule.addDraftShift.mockResolvedValue(undefined)

            await service.run("command-1", "ws-1")

            expect(schedule.addDraftShift.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, null)
        })

        it("removes a draft shift and settles with a null result", async () => {
            const input = { shiftId: "shift-1" }
            const em = queuedCommand("remove-draft-shift", input)
            const { service, schedule } = await build(em)
            schedule.removeDraftShift.mockResolvedValue(undefined)

            await service.run("command-1", "ws-1")

            expect(schedule.removeDraftShift.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, null)
        })

        it("requests publishing and stores the decision status", async () => {
            const input = { scheduleId: "schedule-1" }
            const em = queuedCommand("request-publish", input)
            const { service, schedule } = await build(em)
            schedule.requestPublish.mockResolvedValue({ status: "waiting_decision" })

            await service.run("command-1", "ws-1")

            expect(schedule.requestPublish.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"status":"waiting_decision"}`)
        })

        it("requests a swap and stores its decision status", async () => {
            const input = { kind: "swap", shiftId: "shift-1", toStaffId: "staff-2", reason: "Appointment" }
            const em = queuedCommand("request-swap", input)
            const { service, requests } = await build(em)
            requests.requestSwap.mockResolvedValue({ status: "done" })

            await service.run("command-1", "ws-1")

            expect(requests.requestSwap.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"status":"done"}`)
        })

        it("requests leave and stores its decision status", async () => {
            const input = { from: "2026-10-12", to: "2026-10-14", reason: "Travel" }
            const em = queuedCommand("request-leave", input)
            const { service, requests } = await build(em)
            requests.requestLeave.mockResolvedValue({ status: "waiting_decision" })

            await service.run("command-1", "ws-1")

            expect(requests.requestLeave.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"status":"waiting_decision"}`)
        })

        it("applies an import and stores the added counts", async () => {
            const input = {
                positions: "Cashier",
                staff: "Alex | Cashier | 30k",
                coverage: "Mon | 07:00-11:00 | Cashier | 1",
            }
            const em = queuedCommand("apply-import", input)
            const { service, importing } = await build(em)
            importing.applyImport.mockResolvedValue({ positions: 1, staff: 2, blocks: 3 })

            await service.run("command-1", "ws-1")

            expect(importing.applyImport.mock.calls).toEqual([["user-1", "ws-1", input]])
            expectDone(em, `{"positions":1,"staff":2,"blocks":3}`)
        })

        it("settles an unsupported kind with the command failure sentence", async () => {
            const em = queuedCommand("foreign-command", {})
            const { service, effects, catalog, logger } = await build(em)

            await service.run("command-1", "ws-1")

            expectFailed(em, "SHIFTS_COMMAND_FAILED", "shifts.commandFailed{}")
            expect(catalog.get.mock.calls).toEqual([["shifts.commandFailed", {}, "vi"]])
            for (const effect of effects) expect(effect).not.toHaveBeenCalled()
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("settles a shifts refusal with its code and catalog sentence", async () => {
            const em = queuedCommand("remove-draft-shift", { shiftId: "missing" })
            const { service, schedule, catalog, logger } = await build(em)
            schedule.removeDraftShift.mockRejectedValue(
                new ShiftsError({ code: ShiftsErrorCode.ShiftNotFound, params: { id: "missing" } }),
            )

            await service.run("command-1", "ws-1")

            expectFailed(em, "SHIFTS_SHIFT_NOT_FOUND", `errors.SHIFTS_SHIFT_NOT_FOUND{"id":"missing"}`)
            expect(catalog.get.mock.calls).toEqual([["errors.SHIFTS_SHIFT_NOT_FOUND", { id: "missing" }, "vi"]])
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("settles another domain refusal with its code and catalog sentence", async () => {
            const em = queuedCommand("propose-week", { week: "2026-10-12" })
            const { service, schedule, catalog, logger } = await build(em)
            schedule.proposeWeek.mockRejectedValue(
                new MembershipError({ code: "MEMBERSHIP_FORBIDDEN", params: { role: "viewer", attempts: 2 } }),
            )

            await service.run("command-1", "ws-1")

            expectFailed(em, "MEMBERSHIP_FORBIDDEN", `errors.MEMBERSHIP_FORBIDDEN{"role":"viewer","attempts":2}`)
            expect(catalog.get.mock.calls).toEqual([
                ["errors.MEMBERSHIP_FORBIDDEN", { role: "viewer", attempts: 2 }, "vi"],
            ])
            expect(logger.error).not.toHaveBeenCalled()
        })

        it("logs an unknown error and settles with the command failure sentence", async () => {
            const em = queuedCommand("remove-draft-shift", { shiftId: "shift-1" })
            const { service, schedule, catalog, logger } = await build(em)
            schedule.removeDraftShift.mockRejectedValue(new Error("Database unavailable"))

            await service.run("command-1", "ws-1")

            expectFailed(em, "SHIFTS_COMMAND_FAILED", "shifts.commandFailed{}")
            expect(catalog.get.mock.calls).toEqual([["shifts.commandFailed", {}, "vi"]])
            expect(logger.error.mock.calls).toEqual([
                [ShiftsLogEvent.CommandFailed, { commandId: "command-1", kind: "remove-draft-shift" }],
            ])
        })
    })

    describe("runJob", () => {
        it("ignores a foreign payload", async () => {
            const em = mockEntityManager()
            const { service, effects } = await build(em)

            await service.runJob({ workspaceId: "ws-1", orderId: "order-1" })

            expect(em.query).not.toHaveBeenCalled()
            for (const effect of effects) expect(effect).not.toHaveBeenCalled()
        })

        it("runs the command named by a shifts command payload", async () => {
            const em = queuedCommand("explain-schedule", { scheduleId: "schedule-1" })
            const { service, schedule } = await build(em)
            schedule.explainSchedule.mockResolvedValue({ explanation: "All positions are covered" })

            await service.runJob({ commandId: "command-1", workspaceId: "ws-1" })

            expect(schedule.explainSchedule.mock.calls).toEqual([["user-1", "ws-1", { scheduleId: "schedule-1" }]])
            expectDone(em, `{"explanation":"All positions are covered"}`)
        })
    })
})
