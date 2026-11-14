import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { AgentWorkflowRunsService } from "@modules/domain/agent-graphs"
import { AgentScheduleFireService, AgentWorkSweepService } from "@modules/domain/agent-schedules"
import { ThreadDeadlinesService } from "@modules/domain/agent-threads"
import type { PendingDeadline, RunStop } from "@modules/domain/agent-threads"
import { AgentTasksService, AgentTriggersService, AgentWorkAccessService } from "@modules/domain/agent-work"
import type { AgentTaskRecord, AgentTriggerRecord } from "@modules/domain/agent-work"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { DoorPress } from "./agent-doors.contracts"
import { DoorPressesService } from "./door-presses.service"
import { ScheduledItemsService } from "./scheduled-items.service"

const NOW = "2026-11-11T02:00:00.000Z"
const REMIND_AT = new Date("2026-11-11T04:00:00.000Z")
const OCCASION_AT = new Date("2026-11-18T17:00:00.000Z")
const SLOT = new Date("2026-11-11T14:00:00.000Z")
const DEADLINE_AT = new Date("2026-11-11T03:00:00.000Z")

const task = (over: Partial<AgentTaskRecord>): AgentTaskRecord => ({
    id: "task-1",
    agentId: "agent-sales",
    goalId: null,
    dedupeKey: "remind:order-1",
    title: "Remind order-1",
    detail: "",
    status: "open",
    waitingOn: null,
    nextActionAt: REMIND_AT,
    workItemId: null,
    data: null,
    ...over,
})

const TASKS: ReadonlyArray<AgentTaskRecord> = [
    task({}),
    // A leftover row of the retired care family is listed as the plain task it is (its key and title are no one's business here).
    task({
        id: "task-2",
        dedupeKey: "care:occasion:lead-1:sinhnhat-11-25",
        title: "care due 2026-11-24T17:00:00.000Z",
        nextActionAt: OCCASION_AT,
    }),
    task({ id: "task-3", dedupeKey: "follow-up", title: "Ask the customer again", nextActionAt: null, status: "waiting" }),
]

const trigger = (over: Partial<AgentTriggerRecord>): AgentTriggerRecord => ({
    id: "trigger-1",
    agentId: "agent-accounting",
    kind: "schedule",
    preset: "daily_at",
    atTime: "21:00",
    timeZone: "Asia/Ho_Chi_Minh",
    eventName: null,
    probeKey: "accounting_close",
    enabled: true,
    seedKey: null,
    nextRunAt: SLOT,
    lastFiredAt: null,
    ...over,
})

const installation = (id: string, agentId: string | null, name: string): InstallationRecord =>
    ({ id, agentId, name, workspaceId: "ws-1", moduleKey: "sales" }) as unknown as InstallationRecord

const stop = (over: Partial<RunStop>): RunStop => ({
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "match",
    agentId: "agent-accounting",
    workflowId: "wf-reconcile",
    contactId: null,
    conversationId: null,
    kind: "ai_report",
    state: "open",
    reason: "",
    question: null,
    detail: { suggestions: [], facts: [] },
    cardMessageId: null,
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: NOW,
    resolvedAt: null,
    ...over,
})

const PENDING: ReadonlyArray<PendingDeadline> = [
    {
        stop: stop({}),
        deadline: {
            at: DEADLINE_AT,
            payload: { workspaceId: "ws-1", runId: "run-1", stepKey: "match", repeats: 1, answered: 0 },
        },
    },
]

const PRESS: DoorPress = {
    door: "schedule.run_now",
    subject: `task:task-1:${String(REMIND_AT.getTime())}`,
    memberId: "member-owner",
    memberName: "Owner Lan",
    outcome: "already_ran",
    at: new Date(NOW),
}

interface World {
    readonly manager?: () => Promise<string>
    readonly threads?: boolean
}

const build = async (world: World = {}) => {
    const access = mock<AgentWorkAccessService>({
        manager: jest.fn(world.manager ?? (() => Promise.resolve("member-owner"))),
        agent: jest.fn().mockResolvedValue(undefined),
    })
    const members = mock<WorkspaceMembersService>({
        require: jest.fn().mockResolvedValue({ displayName: "Owner Lan", role: "owner" } as WorkspaceMember),
    })
    const installations = mock<InstallationRecordsService>({
        list: jest.fn().mockResolvedValue([
            installation("inst-sales", "agent-sales", "Sales"),
            installation("inst-accounting", "agent-accounting", "Accounting"),
            installation("inst-none", null, "No agent yet"),
        ]),
    })
    const tasks = mock<AgentTasksService>({
        alive: jest.fn((agentId: string) => Promise.resolve(agentId === "agent-sales" ? TASKS : [])),
        byId: jest.fn((id: string) => Promise.resolve(TASKS.find((one) => one.id === id) ?? null)),
    })
    const triggers = mock<AgentTriggersService>({
        ofAgent: jest.fn((agentId: string) =>
            Promise.resolve(
                agentId === "agent-accounting"
                    ? [trigger({}), trigger({ id: "trigger-off", enabled: false }), trigger({ id: "trigger-event", kind: "event" })]
                    : [],
            ),
        ),
        byId: jest.fn().mockResolvedValue(trigger({})),
    })
    const sweep = mock<AgentWorkSweepService>({ runTaskNow: jest.fn().mockResolvedValue("woken") })
    const fire = mock<AgentScheduleFireService>({ fireNow: jest.fn().mockResolvedValue("woken") })
    const presses = mock<DoorPressesService>({
        recent: jest.fn().mockResolvedValue([PRESS]),
        record: jest.fn().mockResolvedValue(undefined),
    })
    const deadlines = mock<ThreadDeadlinesService>({
        pending: jest.fn().mockResolvedValue(PENDING),
        fireNow: jest.fn().mockResolvedValue("admitted"),
    })
    const workflows = mock<AgentWorkflowRunsService>({
        takersOf: jest.fn((_ws: string, agentId: string, wakes: ReadonlyArray<unknown>) =>
            Promise.resolve(
                wakes.map((_wake, index) =>
                    agentId === "agent-sales" && index === 0
                        ? { workflowId: "wf-remind", key: "payment-reminder", name: "Payment reminder" }
                        : null,
                ),
            ),
        ),
        pinsOf: jest.fn().mockResolvedValue([{ runId: "run-1", workflowId: "wf-reconcile", workflowName: "Reconcile", version: 2 }]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ScheduledItemsService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AgentWorkAccessService, useValue: access },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentTasksService, useValue: tasks },
            { provide: AgentTriggersService, useValue: triggers },
            { provide: AgentWorkSweepService, useValue: sweep },
            { provide: AgentScheduleFireService, useValue: fire },
            { provide: DoorPressesService, useValue: presses },
            ...(world.threads === false ? [] : [{ provide: ThreadDeadlinesService, useValue: deadlines }]),
            { provide: AgentWorkflowRunsService, useValue: workflows },
        ],
    }).compile()
    return { service: moduleRef.get(ScheduledItemsService), access, sweep, fire, presses, deadlines, workflows, tasks }
}

describe("ScheduledItemsService.list (the schedule list)", () => {
    it("lists every timer, slot and deadline of the workspace soonest first: what, for whom, due when, which workflow and step", async () => {
        const { service } = await build()

        const items = await service.list("user-1", "ws-1")

        expect(items.map((item) => [item.kind, item.what, item.subject, item.dueAt.toISOString(), item.agentName])).toEqual([
            ["deadline", "ai_report", { kind: "run", id: "run-1" }, DEADLINE_AT.toISOString(), "Accounting"],
            ["task", "Remind order-1", { kind: "task", id: "task-1" }, REMIND_AT.toISOString(), "Sales"],
            ["schedule", "accounting_close", { kind: "trigger", id: "trigger-1" }, SLOT.toISOString(), "Accounting"],
            ["task", "care due 2026-11-24T17:00:00.000Z", { kind: "task", id: "task-2" }, OCCASION_AT.toISOString(), "Sales"],
        ])
        const [deadline, reminder, slot, occasion] = items
        expect(deadline).toMatchObject({
            id: "deadline:run-1:match:1.0",
            runId: "run-1",
            stepKey: "match",
            workflow: { workflowId: "wf-reconcile", name: "Reconcile" },
        })
        expect(reminder).toMatchObject({
            id: `task:task-1:${String(REMIND_AT.getTime())}`,
            installationId: "inst-sales",
            workflow: { workflowId: "wf-remind", name: "Payment reminder" },
            stepKey: null,
            realDueAt: null,
            lastPress: { memberName: "Owner Lan", outcome: "already_ran" },
        })
        expect(slot).toMatchObject({ id: `schedule:trigger-1:${String(SLOT.getTime())}`, workflow: null, realDueAt: null })
        expect(occasion).toMatchObject({ kind: "task", realDueAt: null })
    })

    it("asks the workflows which one each wake goes to, once per agent, with the very wakes the timers write", async () => {
        const { service, workflows } = await build()

        await service.list("user-1", "ws-1")

        const calls = workflows.takersOf.mock.calls.map(([, agentId, wakes]) => [agentId, wakes.map((wake) => wake.source)])
        // Ledger (ROAD Opus-1d, 2026-11-14): a clock slot is delivered as the `clock.tick` event of the one pipeline
        // (`ClockTickDeliveryService.deliverSlot`), so its wake is of source `trigger` (it was the retired `schedule` road).
        expect(calls).toEqual([
            ["agent-sales", ["internal", "internal"]],
            ["agent-accounting", ["trigger"]],
        ])
        expect(workflows.takersOf.mock.calls[1]?.[2]?.[0]?.context).toMatchObject({ verb: TRIGGER.clockTick })
        // A task's wake names the task alone (the internal wake the minute sweep writes), whatever its key says: a leftover care-keyed row too.
        const wakes = workflows.takersOf.mock.calls[0]?.[2] ?? []
        expect(wakes.map((wake) => wake.context)).toEqual([
            { taskId: "task-1", subjectId: "task-1" },
            { taskId: "task-2", subjectId: "task-2" },
        ])
    })

    it("lists no deadline in an app with no thread runs, and refuses a seat that is not an owner or manager before it reads anything", async () => {
        const quiet = await build({ threads: false })
        const denied = new Error("seat refused")
        const staff = await build({ manager: () => Promise.reject(denied) })

        expect((await quiet.service.list("user-1", "ws-1")).map((item) => item.kind)).not.toContain("deadline")
        await expect(staff.service.list("user-2", "ws-1")).rejects.toBe(denied)
        expect(staff.tasks.alive).not.toHaveBeenCalled()
    })
})

describe("ScheduledItemsService.runNow (\"run now\")", () => {
    it("moves a task's own timer to now through the minute sweep's own wake, as the person, and records the press", async () => {
        const { service, sweep, access, presses } = await build()
        const id = `task:task-1:${String(REMIND_AT.getTime())}`

        await expect(service.runNow("user-1", "ws-1", id)).resolves.toEqual({ outcome: "ran", id })

        expect(access.agent).toHaveBeenCalledWith("ws-1", "agent-sales")
        expect(sweep.runTaskNow).toHaveBeenCalledWith(
            { kind: "task", workspaceId: "ws-1", agentId: "agent-sales", scopeKey: "agent", subjectId: "task-1", at: REMIND_AT },
            { memberId: "member-owner", at: new Date(NOW) },
        )
        expect(presses.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            door: "schedule.run_now",
            subject: id,
            memberId: "member-owner",
            memberName: "Owner Lan",
            outcome: "ran",
            detail: { kind: "task" },
        })
    })

    it("runs a clock slot through the fire's own key, and a stop's deadline through the deadline's own door", async () => {
        const { service, fire, deadlines } = await build()

        await expect(service.runNow("user-1", "ws-1", `schedule:trigger-1:${String(SLOT.getTime())}`)).resolves.toMatchObject({
            outcome: "ran",
        })
        await expect(service.runNow("user-1", "ws-1", "deadline:run-1:match:1.0")).resolves.toMatchObject({ outcome: "ran" })

        expect(fire.fireNow).toHaveBeenCalledWith("ws-1", "trigger-1", SLOT, "member-owner")
        expect(deadlines.fireNow).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            runId: "run-1",
            stepKey: "match",
            repeats: 1,
            answered: 0,
        })
    })

    it("answers already_ran for an item that fired (no second job), refused when the thread no longer waits, and invalid for no key", async () => {
        const { service, sweep, fire, deadlines, presses } = await build()
        sweep.runTaskNow.mockResolvedValue("already_ran")
        fire.fireNow.mockResolvedValue("not_scheduled")
        deadlines.fireNow.mockResolvedValueOnce("moved").mockResolvedValueOnce("refused")

        const answers = await Promise.all([
            service.runNow("user-1", "ws-1", `task:task-1:${String(REMIND_AT.getTime())}`),
            service.runNow("user-1", "ws-1", `schedule:trigger-1:${String(SLOT.getTime())}`),
            service.runNow("user-1", "ws-1", "deadline:run-1:match:1.0"),
            service.runNow("user-1", "ws-1", "deadline:run-1:match:1.0"),
            service.runNow("user-1", "ws-1", "nonsense"),
        ])

        expect(answers.map((answer) => answer.outcome).toSorted()).toEqual(
            ["already_ran", "already_ran", "invalid", "not_scheduled", "refused"].toSorted(),
        )
        expect(presses.record).toHaveBeenCalledTimes(4)
    })

    it("refuses a seat that is not an owner or manager, and touches nothing", async () => {
        const denied = new Error("seat refused")
        const { service, sweep, presses } = await build({ manager: () => Promise.reject(denied) })

        await expect(service.runNow("user-2", "ws-1", `task:task-1:${String(REMIND_AT.getTime())}`)).rejects.toBe(denied)
        expect(sweep.runTaskNow).not.toHaveBeenCalled()
        expect(presses.record).not.toHaveBeenCalled()
    })
})
