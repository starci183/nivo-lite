import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { AgentTurnView } from "@modules/domain/agent-work"
import { DeliveredWakesService } from "@modules/domain/provider-triggers/delivered-wakes.service"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { holdsCustomerAt, nextOnDutyAt, workingHoursOf } from "@modules/domain/modules"
import { WorkspaceTimeZoneService } from "@modules/domain/workspace-settings"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { personEventOf } from "./policies/workflow-trigger.policy"


/** The mark of a wake written again for the agent's next working hour: `<key>~open-<n>`, `n` counting the times it was held. */
const OPEN_MARK = "~open-"

/** The key of a wake as it was first written, and how many times it was held for the hours already. */
interface HeldKey {
    /** The key as first written. */
    readonly base: string
    /** How many times it was held. */
    readonly held: number
}

const heldKeyOf = (eventKey: string): HeldKey => {
    const at = eventKey.lastIndexOf(OPEN_MARK)
    if (at < 0) return { base: eventKey, held: 0 }
    const held = Number(eventKey.slice(at + OPEN_MARK.length))
    return Number.isInteger(held) ? { base: eventKey.slice(0, at), held } : { base: eventKey, held: 0 }
}

@Injectable()
/**
 * The agent's working hours as an engine rule, never a branch of a graph: a customer who writes while the agent is off duty, and the
 * owner turned "answer after hours" off, starts no run then. The wake is written again for the agent's next working hour (its drain waits
 * until then) and this one ends held, so the customer's line is answered when the shop opens, once. A wake that comes due early (another
 * wake of the conversation drained first) is held again under the next count, so it is never lost.
 */
export class AgentGraphHoursGateService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly installations: InstallationRecordsService,
        private readonly wakes: DeliveredWakesService,
        private readonly zones: WorkspaceTimeZoneService,
    ) {}

    /** True when the wake was held for the agent's next working hour: it starts no run now. */
    async deferred(turn: AgentTurnView): Promise<boolean> {
        if (!personEventOf(turn.context)) return false
        const installation = await this.installations.ofAgent(turn.workspaceId, turn.agentId)
        const hours = workingHoursOf(installation?.settings.workingHours ?? null)
        const now = this.clock.now()
        const timeZone = await this.zones.timeZoneOf(turn.workspaceId)
        if (!holdsCustomerAt(hours, now, timeZone)) return false
        const openAt = hours === null ? null : nextOnDutyAt(hours, now, timeZone)
        if (openAt === null) return false
        const { base, held } = heldKeyOf(turn.eventKey)
        await this.entityManager.transaction((tx) =>
            this.wakes.rewrite(tx, {
                workspaceId: turn.workspaceId,
                agentId: turn.agentId,
                source: turn.source,
                eventKey: `${base}${OPEN_MARK}${held + 1}`,
                context: turn.context,
                actorMemberId: turn.actorMemberId,
                scopeKey: turn.scopeKey,
                delayMs: Math.max(0, openAt.getTime() - now.getTime()),
            }),
        )
        this.logger.info(AgentGraphsLogEvent.HeldForHours, {
            agentId: turn.agentId,
            wakeId: turn.wakeId,
            openAt: openAt.toISOString(),
        })
        return true
    }
}
