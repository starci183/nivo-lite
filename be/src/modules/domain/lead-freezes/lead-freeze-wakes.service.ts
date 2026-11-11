import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentWakeService } from "@modules/domain/agent-work"
import type { AgentWakeContext } from "@modules/domain/agent-work"
import { eachInOrder } from "@modules/platform/primitives"
import { replayKeyOf } from "./lead-freeze.policy"
import type { LeadFreeze, PendingContextValue, PendingEvent } from "./lead-freezes.contracts"

/** Whether a kept context reads as a wake's context: texts everywhere but the one flag and the language. */
const isWakeContext = (
    context: Readonly<Record<string, PendingContextValue>>,
): context is AgentWakeContext & Readonly<Record<string, PendingContextValue>> =>
    Object.entries(context).every(([name, value]) => {
        if (name === "lookupName") return typeof value === "boolean"
        if (name === "locale") return value === "vi" || value === "en"
        return typeof value === "string"
    })

/** A wake's context as a pending event kept it; a member that no context holds is dropped. */
const wakeContextOf = (context: Readonly<Record<string, PendingContextValue>>): AgentWakeContext => {
    if (isWakeContext(context)) return context
    const kept = Object.fromEntries(Object.entries(context).filter(([name, value]) => isWakeContext({ [name]: value })))
    return isWakeContext(kept) ? kept : {}
}

@Injectable()
/**
 * What a freeze writes outside itself: the replay of the events it held, as new wakes of the same agents in the order they came (each
 * under its own key marked with the freeze, so one release writes it once).
 */
export class LeadFreezeWakesService {
    constructor(private readonly wakes: AgentWakeService) {}

    /**
     * Writes the events again as wakes in `tx`, oldest first; answers how many were written (a replay already written is skipped). The
     * wake each event was held from is closed in the same `tx`, pointing at its replay (`AgentWakeService.superseded`): the event is
     * then carried by exactly one live wake, never by the replay and a held original both.
     */
    async replay(
        tx: EntityManager,
        workspaceId: string,
        freeze: LeadFreeze,
        events: ReadonlyArray<PendingEvent>,
    ): Promise<number> {
        const written: Array<boolean> = []
        await eachInOrder(events, async (event) => {
            const id = await this.wakes.write(tx, {
                workspaceId,
                agentId: event.agentId,
                source: event.source,
                eventKey: replayKeyOf(event, freeze.id, freeze.episode),
                context: wakeContextOf(event.context),
                actorMemberId: event.actorMemberId,
                ...(event.scopeKey === "" ? {} : { scopeKey: event.scopeKey }),
            })
            if (id !== null && event.wakeId !== "") await this.wakes.superseded(tx, workspaceId, event.wakeId, id)
            written.push(id !== null)
        })
        return written.filter(Boolean).length
    }
}
