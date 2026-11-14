import { Injectable, Optional } from "@nestjs/common"
import { AgentWorkflowRunsService, type FlowWake, type RunPinView } from "@modules/domain/agent-graphs"
import { AgentScheduleFireService, AgentWorkSweepService } from "@modules/domain/agent-schedules"
import { ThreadDeadlinesService, type DeadlineFiring, type PendingDeadline } from "@modules/domain/agent-threads"
import { CLOCK_TICK_TRIGGER, TIMER_DUE_TRIGGER } from "@modules/domain/agent-schedules/engine-time.triggers"
import {
    AgentTasksService,
    AgentTriggersService,
    AgentWorkAccessService,
    timerTaskOf,
    type AgentTaskRecord,
    type AgentTriggerRecord,
} from "@modules/domain/agent-work"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentDoorsLogEvent } from "./agent-doors.log-events"
import type {
    DoorActor,
    DoorPress,
    RunNowAnswer,
    RunNowOutcome,
    ScheduledItem,
    ScheduledWorkflow,
} from "./agent-doors.contracts"
import { DoorPressesService } from "./door-presses.service"
import {
    bySoonest,
    deadlineKeyOf,
    scheduleKeyOf,
    scheduledKeyOf,
    taskKeyOf,
    type ScheduledKey,
} from "./scheduled-items.policy"

/** The door a run-now press is recorded under. */
const RUN_NOW = "schedule.run_now"

/** The most open stops whose deadlines the list reads. */
const DEADLINES_MAX = 50

/** The most presses the list reads to name the last press of each item. */
const PRESSES_READ = 200

/** The most items one list answers. */
export const SCHEDULED_ITEMS_MAX = 200

/** An agent of the workspace with its installation. */
interface Seat {
    readonly agentId: string
    readonly installation: InstallationRecord
}

/** What a deadline's firing means for the person who pressed. */
const outcomeOfFiring = (firing: DeadlineFiring): RunNowOutcome => {
    if (firing === "admitted") return "ran"
    return firing === "refused" ? "refused" : "already_ran"
}

/**
 * The wake a task writes when it falls due, as the workflows judge it: a timer's `timer.due` event as the delivery writes it (its verb,
 * its data from the timer's own pure translate: `ClockTickDeliveryService.deliverTimer`), else the internal wake of a plain task.
 */
const taskWakeOf = (task: AgentTaskRecord): FlowWake => {
    const timer = timerTaskOf(task.dedupeKey, task.title, task.data)
    const event =
        timer === null
            ? null
            : TIMER_DUE_TRIGGER.translate(
                  {
                      taskId: task.id,
                      ref: timer.ref,
                      ...(timer.data === undefined ? {} : { data: timer.data }),
                      dueAt: timer.dueAt,
                  },
                  { connectionId: null },
              )
    if (event === null)
        return { source: "internal", context: { taskId: task.id, subjectId: task.id }, actorMemberId: null }
    const context = { verb: TIMER_DUE_TRIGGER.verb, eventId: event.id, dataJson: JSON.stringify(event.data) }
    return { source: "trigger", context, actorMemberId: null }
}

/** The wake a clock slot writes: its `clock.tick` event as the delivery writes it (`ClockTickDeliveryService.deliverSlot`). */
const slotWakeOf = (trigger: AgentTriggerRecord, slot: Date): FlowWake => {
    const event = CLOCK_TICK_TRIGGER.translate(
        {
            triggerId: trigger.id,
            slot: String(slot.getTime()),
            ...(trigger.probeKey === null ? {} : { probeKey: trigger.probeKey }),
        },
        { connectionId: null },
    )
    const context =
        event === null ? {} : { verb: CLOCK_TICK_TRIGGER.verb, eventId: event.id, dataJson: JSON.stringify(event.data) }
    return { source: "trigger", context, actorMemberId: null }
}

/** The workflow a stopped run executes: its pin (with the workflow's name), else the stop's own workflow id, else none. */
const pinnedWorkflowOf = (pin: RunPinView | undefined, workflowId: string | null): ScheduledWorkflow | null => {
    if (pin !== undefined) return { workflowId: pin.workflowId, key: null, name: pin.workflowName }
    return workflowId === null ? null : { workflowId, key: null, name: "" }
}

/** A scheduled timer of a task: open with a wake time. */
const isTimed = (task: AgentTaskRecord): task is AgentTaskRecord & { readonly nextActionAt: Date } =>
    task.status === "open" && task.nextActionAt !== null

/** A clock trigger that holds a next slot. */
const isSlotted = (trigger: AgentTriggerRecord): trigger is AgentTriggerRecord & { readonly nextRunAt: Date } =>
    trigger.enabled && trigger.kind === "schedule" && trigger.nextRunAt !== null

@Injectable()
/**
 * the schedule list with "run now": what is scheduled in a workspace (the tasks of its agents, the next slot of
 * each clock trigger, the deadline of each open stop), for whom, due when and which workflow and step it will wake; and "run now" for
 * one item, which moves the item's OWN job to now through its own mechanism, never a second job: a task's wake is written now under
 * the key its timer would write (so the timer finds it written), a slot's wake likewise (so the cron's fire adds nothing), a stop's
 * deadline is answered now through the deadline's own door (so the delayed job finds the stop moved). Owner or manager only; every
 * press is recorded with who and when. A list for people; nothing here is on a customer's path.
 */
export class ScheduledItemsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly access: AgentWorkAccessService,
        private readonly members: WorkspaceMembersService,
        private readonly installations: InstallationRecordsService,
        private readonly tasks: AgentTasksService,
        private readonly triggers: AgentTriggersService,
        private readonly sweep: AgentWorkSweepService,
        private readonly fire: AgentScheduleFireService,
        private readonly presses: DoorPressesService,
        @Optional() private readonly deadlines?: ThreadDeadlinesService,
        @Optional() private readonly workflows?: AgentWorkflowRunsService,
    ) {}

    /** What is scheduled in the workspace, soonest first. Owner or manager only. */
    async list(userId: string, workspaceId: string): Promise<ReadonlyArray<ScheduledItem>> {
        await this.access.manager(userId, workspaceId)
        const seats = (await this.installations.list(workspaceId)).flatMap((installation) =>
            installation.agentId === null ? [] : [{ agentId: installation.agentId, installation }],
        )
        const pressed = new Map<string, DoorPress>()
        for (const press of (await this.presses.recent(workspaceId, RUN_NOW, PRESSES_READ)).toReversed())
            pressed.set(press.subject, press)
        const items: Array<ScheduledItem> = []
        await eachInOrder(seats, async (seat) => {
            items.push(...(await this.ofAgent(workspaceId, seat, pressed)))
        })
        items.push(...(await this.ofDeadlines(workspaceId, seats, pressed)))
        return items.toSorted(bySoonest).slice(0, SCHEDULED_ITEMS_MAX)
    }

    /** Runs one item now. Owner or manager only; the press is recorded with its outcome. */
    async runNow(userId: string, workspaceId: string, id: string): Promise<RunNowAnswer> {
        const actor = await this.actorOf(userId, workspaceId)
        const key = scheduledKeyOf(id)
        if (key === null) return { outcome: "invalid", id }
        const outcome = await this.ran(workspaceId, key, actor)
        await this.presses.record({
            workspaceId,
            door: RUN_NOW,
            subject: id,
            memberId: actor.memberId,
            memberName: actor.name,
            outcome,
            detail: { kind: key.kind },
        })
        this.logger.info(AgentDoorsLogEvent.RunNow, { kind: key.kind, outcome })
        return { outcome, id }
    }

    private async actorOf(userId: string, workspaceId: string): Promise<DoorActor> {
        const memberId = await this.access.manager(userId, workspaceId)
        const member = await this.members.require(userId, workspaceId)
        return { memberId, name: member.displayName }
    }

    private ran(workspaceId: string, key: ScheduledKey, actor: DoorActor): Promise<RunNowOutcome> {
        if (key.kind === "task") return this.taskNow(workspaceId, key.taskId, key.at, actor)
        if (key.kind === "schedule") return this.slotNow(workspaceId, key.triggerId, key.slot, actor)
        return this.deadlineNow(workspaceId, key)
    }

    private async taskNow(workspaceId: string, taskId: string, at: Date, actor: DoorActor): Promise<RunNowOutcome> {
        const task = await this.tasks.byId(taskId)
        if (task === null) return "not_scheduled"
        await this.access.agent(workspaceId, task.agentId)
        const woken = await this.sweep.runTaskNow(
            { kind: "task", workspaceId, agentId: task.agentId, scopeKey: "agent", subjectId: task.id, at },
            { memberId: actor.memberId, at: this.clock.now() },
        )
        return woken === "woken" ? "ran" : "already_ran"
    }

    private async slotNow(
        workspaceId: string,
        triggerId: string,
        slot: Date,
        actor: DoorActor,
    ): Promise<RunNowOutcome> {
        const trigger = await this.triggers.byId(triggerId)
        if (trigger === null) return "not_scheduled"
        await this.access.agent(workspaceId, trigger.agentId)
        const fired = await this.fire.fireNow(workspaceId, triggerId, slot, actor.memberId)
        return fired === "woken" ? "ran" : fired
    }

    private async deadlineNow(
        workspaceId: string,
        key: ScheduledKey & { readonly kind: "deadline" },
    ): Promise<RunNowOutcome> {
        if (this.deadlines === undefined) return "not_scheduled"
        const firing = await this.deadlines.fireNow({
            workspaceId,
            runId: key.runId,
            stepKey: key.stepKey,
            repeats: key.repeats,
            answered: key.answered,
        })
        return outcomeOfFiring(firing)
    }

    /** The timers of an agent's tasks and the next slots of its clock triggers, each with the workflow it will wake. */
    private async ofAgent(
        workspaceId: string,
        seat: Seat,
        pressed: ReadonlyMap<string, DoorPress>,
    ): Promise<ReadonlyArray<ScheduledItem>> {
        const timed = (await this.tasks.alive(seat.agentId)).filter(isTimed)
        const slotted = (await this.triggers.ofAgent(seat.agentId)).filter(isSlotted)
        const wakes = [
            ...timed.map((task) => taskWakeOf(task)),
            ...slotted.map((trigger) => slotWakeOf(trigger, trigger.nextRunAt)),
        ]
        const takers = (await this.workflows?.takersOf(workspaceId, seat.agentId, wakes)) ?? []
        const workflowAt = (index: number): ScheduledWorkflow | null => takers[index] ?? null
        const base = {
            agentId: seat.agentId,
            installationId: seat.installation.id,
            agentName: seat.installation.name,
            runId: null,
            stepKey: null,
        }
        const ofTasks = timed.map((task, index): ScheduledItem => {
            const id = taskKeyOf(task.id, task.nextActionAt)
            return {
                ...base,
                id,
                kind: "task",
                what: task.title,
                subject: { kind: "task", id: task.id },
                dueAt: task.nextActionAt,
                realDueAt: null,
                workflow: workflowAt(index),
                lastPress: pressed.get(id) ?? null,
            }
        })
        const ofSlots = slotted.map((trigger, index): ScheduledItem => {
            const id = scheduleKeyOf(trigger.id, trigger.nextRunAt)
            return {
                ...base,
                id,
                kind: "schedule",
                what: trigger.probeKey ?? trigger.preset ?? "schedule",
                subject: { kind: "trigger", id: trigger.id },
                dueAt: trigger.nextRunAt,
                realDueAt: null,
                workflow: workflowAt(timed.length + index),
                lastPress: pressed.get(id) ?? null,
            }
        })
        return [...ofTasks, ...ofSlots]
    }

    /** The deadlines of the open stops of the workspace's thread runs, each naming its run, its workflow and its stopped step. */
    private async ofDeadlines(
        workspaceId: string,
        seats: ReadonlyArray<Seat>,
        pressed: ReadonlyMap<string, DoorPress>,
    ): Promise<ReadonlyArray<ScheduledItem>> {
        const pending: ReadonlyArray<PendingDeadline> =
            (await this.deadlines?.pending(workspaceId, DEADLINES_MAX)) ?? []
        if (pending.length === 0) return []
        const pins =
            (await this.workflows?.pinsOf(
                workspaceId,
                pending.map(({ stop }) => stop.runId),
            )) ?? []
        return pending.map(({ stop, deadline }): ScheduledItem => {
            const id = deadlineKeyOf(stop.runId, stop.stepKey, deadline.payload.repeats, deadline.payload.answered)
            const seat = seats.find((one) => one.agentId === stop.agentId)
            const pin = pins.find((one) => one.runId === stop.runId)
            const workflow = pinnedWorkflowOf(pin, stop.workflowId)
            return {
                id,
                kind: "deadline",
                what: stop.kind,
                agentId: stop.agentId,
                installationId: seat?.installation.id ?? null,
                agentName: seat?.installation.name ?? null,
                subject: { kind: "run", id: stop.runId },
                dueAt: deadline.at,
                realDueAt: null,
                workflow,
                stepKey: stop.stepKey,
                runId: stop.runId,
                lastPress: pressed.get(id) ?? null,
            }
        })
    }
}
