import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"
import type { OptionalCanonicalEvent, TriggerDeclaration } from "@modules/domain/provider-triggers"

/*
 * THE ENGINE'S TIME SOURCES (stage 1 of the one event pipeline, concept triggers rule 13): a slot of a clock trigger and a due timer, each
 * declared like any provider's trigger, with a pure translate of what the source fired. The receiver is the agent the source row names (the
 * clock's `agent_triggers` row, the timer's task): the entry hands that agent to the delivery, nothing else chooses it. A clock tick only
 * starts a workflow (each slot its own run); listing and fan-out are that workflow's own steps.
 */

/** The clock's trigger name. */
export const CLOCK_TICK = "clock.tick"

/** The timer's trigger name. */
export const TIMER_DUE = "timer.due"

/** What one slot of a clock trigger fired: the trigger row and the slot (epoch milliseconds as text). */
export type ClockSlot = {
    readonly triggerId: string
    readonly slot: string
}

/** The data of a clock tick: the row that fired and the slot it fired for. */
export type ClockTickData = {
    readonly triggerId: string
    readonly slotMs: number
}

/** The translate of a clock slot: one event per (trigger row, slot), the once-key the slot's wake always had. */
export const translateClockSlot = (slot: ClockSlot): OptionalCanonicalEvent<ClockTickData> => {
    const slotMs = Number(slot.slot)
    if (slot.triggerId === "" || !Number.isSafeInteger(slotMs)) return null
    return {
        id: `${slot.triggerId}:${slot.slot}`,
        data: { triggerId: slot.triggerId, slotMs },
    }
}

/** The clock's declaration: no key, every slot its own run. */
export const CLOCK_TICK_TRIGGER: TriggerDeclaration<ClockSlot, ClockTickData> = {
    provider: PROVIDER.nivo,
    name: CLOCK_TICK,
    verb: TRIGGER.clockTick,
    via: "clock",
    raw: z.object({ triggerId: z.string(), slot: z.string() }),
    data: z.object({ triggerId: z.string().min(1), slotMs: z.number().int() }),
    translate: translateClockSlot,
    key: { by: "none" },
    settle: null,
}

/** A timer that fell due, as its task holds it: the task, the arm's `ref` and `data`, the due instant, who pressed "run now". */
export type DueTimer = {
    readonly taskId: string
    readonly ref: string
    readonly data?: Readonly<Record<string, string | number | boolean | null>> | undefined
    readonly dueAt: string
    /** When it fired, when that is not its due instant (a person's "run now"). */
    readonly firedAt?: string | undefined
    readonly runNowBy?: string | undefined
}

/** The data of a due timer: the task (the key: one task per agent, person and ref), the ref, the arm's data and the moment it fired. */
export type TimerDueData = {
    readonly taskId: string
    readonly ref: string
    readonly data: Readonly<Record<string, string | number | boolean | null>>
    readonly dueAt: string
    readonly runNowBy?: string | undefined
}

/** The translate of a due timer: one event per (task, due instant), the once-key the timer's wake always had. */
export const translateDueTimer = (timer: DueTimer): OptionalCanonicalEvent<TimerDueData> => {
    const due = Date.parse(timer.dueAt)
    if (timer.taskId === "" || timer.ref === "" || Number.isNaN(due)) return null
    return {
        id: `timer:${timer.taskId}:${String(due)}`,
        data: {
            taskId: timer.taskId,
            ref: timer.ref,
            data: timer.data ?? {},
            dueAt: timer.firedAt ?? timer.dueAt,
            ...(timer.runNowBy === undefined ? {} : { runNowBy: timer.runNowBy }),
        },
    }
}

/** A flat record of JSON scalars (a timer's `data`). */
const SCALARS = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))

/** The timer's declaration, keyed by its task. The person it is about rides beside the event (the arming run's contact and route). */
export const TIMER_DUE_TRIGGER: TriggerDeclaration<DueTimer, TimerDueData> = {
    provider: PROVIDER.nivo,
    name: TIMER_DUE,
    verb: TRIGGER.timerDue,
    via: "clock",
    raw: z.object({
        taskId: z.string(),
        ref: z.string(),
        data: SCALARS.optional(),
        dueAt: z.string(),
        firedAt: z.string().optional(),
        runNowBy: z.string().optional(),
    }),
    data: z.object({
        taskId: z.string().min(1),
        ref: z.string().min(1),
        data: SCALARS,
        dueAt: z.string(),
        runNowBy: z.string().optional(),
    }),
    translate: translateDueTimer,
    key: { by: "data", member: "taskId" },
    settle: null,
}

/** The engine's time triggers. */
export const ENGINE_TIME_TRIGGERS: ReadonlyArray<TriggerDeclaration<ClockSlot, ClockTickData> | TriggerDeclaration<DueTimer, TimerDueData>> = [
    CLOCK_TICK_TRIGGER,
    TIMER_DUE_TRIGGER,
]
