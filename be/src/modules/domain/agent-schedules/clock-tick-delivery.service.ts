import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { AgentTriggerRecord, TimerTask } from "@modules/domain/agent-work"
import { ProviderTriggersService, type DeliverResult } from "@modules/domain/provider-triggers"
import type { TimerOwner } from "./agent-schedules.contracts"
import { CLOCK_TICK_TRIGGER, TIMER_DUE_TRIGGER } from "./engine-time.triggers"

/** What delivering one slot came to: a run was woken, the slot was delivered before (`already_ran`), or no registered graph took it. */
export type SlotDelivery = "woken" | "already_ran" | "untaken"

/** What the delivery's answer says of one slot. */
export const slotDeliveryOf = (result: DeliverResult): SlotDelivery => {
    if (result.status !== "delivered") return "untaken"
    if (result.woken.length > 0) return "woken"
    return result.repeats > 0 ? "already_ran" : "untaken"
}

@Injectable()
/**
 * THE CLOCK'S ENTRY to the one event pipeline (concept triggers rule 13): one slot of one `agent_triggers` row, translated by the clock's
 * pure declaration and handed to the ONE delivery function for the row's own agent, in the caller's transaction. The once-key is the
 * slot's old one (`<trigger row>:<slot>`), so the job, the sweep's missed-slot repair and a person's "run now" of the same slot are one
 * event. The receiver is the agent the row names; nothing else chooses it. The due timers of the agents' tasks enter the same way.
 */
export class ClockTickDeliveryService {
    constructor(private readonly triggers: ProviderTriggersService) {}

    /** Delivers the slot (epoch milliseconds as text) of the row; `memberId` is the person who pressed "run now", else null. */
    async deliverSlot(
        tx: EntityManager,
        workspaceId: string,
        trigger: AgentTriggerRecord,
        slot: string,
        memberId: string | null,
    ): Promise<SlotDelivery> {
        const event = CLOCK_TICK_TRIGGER.translate(
            { triggerId: trigger.id, slot },
            { connectionId: null },
        )
        if (event === null) return "untaken"
        const result = await this.triggers.deliver(
            {
                workspaceId,
                declaration: CLOCK_TICK_TRIGGER,
                connectionId: null,
                agentId: trigger.agentId,
                events: [{ event, actorMemberId: memberId, occurredAt: new Date(Number(slot)).toISOString() }],
            },
            tx,
        )
        return slotDeliveryOf(result)
    }

    /**
     * THE TIMER'S ENTRY: a timer that fell due (or a person's "run now" of it), translated by the timer's pure declaration and delivered for
     * the task's own agent, with the person the arming run had (its contact and route) beside the event. The once-key is the timer's old
     * one (`timer:<task>:<due instant>`), so a retried sweep and a press of the same timer are one event.
     */
    async deliverTimer(
        tx: EntityManager,
        owner: TimerOwner,
        taskId: string,
        timer: TimerTask,
        press: { readonly memberId: string; readonly at: Date } | null,
    ): Promise<SlotDelivery> {
        const event = TIMER_DUE_TRIGGER.translate(
            {
                taskId,
                ref: timer.ref,
                ...(timer.data === undefined ? {} : { data: timer.data }),
                dueAt: timer.dueAt,
                ...(press === null ? {} : { firedAt: press.at.toISOString(), runNowBy: press.memberId }),
            },
            { connectionId: null },
        )
        if (event === null) return "untaken"
        const result = await this.triggers.deliver(
            {
                workspaceId: owner.workspaceId,
                declaration: TIMER_DUE_TRIGGER,
                connectionId: null,
                agentId: owner.agentId,
                events: [
                    {
                        event,
                        contactId: timer.subject.contactId,
                        routeId: timer.subject.conversationId,
                        actorMemberId: press?.memberId ?? null,
                        occurredAt: timer.dueAt,
                    },
                ],
            },
            tx,
        )
        return slotDeliveryOf(result)
    }
}
