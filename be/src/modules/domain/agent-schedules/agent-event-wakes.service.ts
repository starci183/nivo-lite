import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentTriggersService, AgentWakeService, type AgentWakeSource } from "@modules/domain/agent-work"
import { InjectInstallations, type InstallationDirectory } from "@modules/domain/agents"
import { MODULE_CATALOG } from "@modules/domain/modules"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectInbox, type Inbox } from "@modules/platform/inbox"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import { EVENT_WAKE_AGENTS_MAX, firstPerAgent, triggersOfModule, wakeKeyOf } from "./agent-schedules.policy"
import type { EventClaim, EventTarget, InstallationChange, InternalEventFact } from "./agent-schedules.contracts"

const INTERNAL_SOURCE: AgentWakeSource = "internal"

@Injectable()
/**
 * What the internal events of the business do to the agents. A fact (money in, a new document, a payment) wakes only the agents of its
 * workspace that hold an enabled event trigger for its name, once per agent and fact: the wake is keyed by the event and its dedupe key,
 * so a replay is one wake, and the probe of the trigger decides later whether the model is needed. A changed installation seeds the
 * triggers its module declares, one row per key, so installing or applying again writes nothing new. Each delivery is claimed in the
 * inbox in the transaction of its effect.
 */
export class AgentEventWakesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectInbox() private readonly inbox: Inbox,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectLogger() private readonly logger: Logger,
        private readonly triggers: AgentTriggersService,
        private readonly wakes: AgentWakeService,
        private readonly sync: AgentTriggerSyncService,
    ) {}

    /** Wakes the agents that asked for this fact, in the transaction that claims its delivery; a redelivery wakes nobody twice. */
    eventHappened(fact: InternalEventFact, claim: EventClaim): Promise<void> {
        return this.entityManager.transaction(async (tx) => {
            if (!(await this.inbox.claim(claim.consumer, claim.dedupeKey, tx))) return
            const rows = await this.triggers.enabledForSource(
                fact.workspaceId,
                fact.eventName,
                EVENT_WAKE_AGENTS_MAX,
                INTERNAL_SOURCE,
            )
            await eachInOrder(firstPerAgent(rows), (trigger) =>
                this.wakes.wake(tx, {
                    workspaceId: fact.workspaceId,
                    agentId: trigger.agentId,
                    source: "internal",
                    eventKey: wakeKeyOf(fact.eventName, fact.dedupeKey),
                    context: {
                        eventName: fact.eventName,
                        subjectId: fact.subjectId,
                        ...(trigger.probeKey === null ? {} : { probeKey: trigger.probeKey }),
                    },
                    actorMemberId: null,
                }),
            )
        })
    }

    /**
     * The agents of the workspace that hold an enabled event trigger for this event type and answer to this source, each once, with the probe of
     * the first trigger that matched. The one matcher of events: an internal fact and an inbound adapter's event both ask here.
     */
    async agentsFor(
        workspaceId: string,
        eventType: string,
        source: AgentWakeSource,
    ): Promise<ReadonlyArray<EventTarget>> {
        const rows = await this.triggers.enabledForSource(workspaceId, eventType, EVENT_WAKE_AGENTS_MAX, source)
        return firstPerAgent(rows).map((row) => ({ agentId: row.agentId, probeKey: row.probeKey }))
    }

    /** Seeds the triggers the module of a changed installation declares for its agent; a change of the whole workspace seeds nothing. */
    installationChanged(change: InstallationChange, claim: EventClaim): Promise<void> {
        return this.entityManager.transaction(async (tx) => {
            if (!(await this.inbox.claim(claim.consumer, claim.dedupeKey, tx))) return
            if (change.installationId === undefined) return
            const installation = await this.installations.byId(change.workspaceId, change.installationId)
            if (installation === null || installation.removed || installation.agentId === null) return
            const seeds = triggersOfModule(MODULE_CATALOG, installation.module)
            if (seeds.length === 0) return
            await this.sync.seed(change.workspaceId, installation.agentId, seeds)
            this.logger.info(AgentSchedulesLogEvent.TriggersSeeded, {
                agentId: installation.agentId,
                seeds: seeds.length,
            })
        })
    }
}
