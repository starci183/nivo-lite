import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentTriggersService, AgentWakeService } from "@modules/domain/agent-work"
import { InjectInstallations } from "@modules/domain/agents"
import type { InstallationDirectory } from "@modules/domain/agents"
import { MODULE_CATALOG } from "@modules/domain/modules"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectInbox } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import { AgentTriggerSyncService } from "./agent-trigger-sync.service"
import { EVENT_WAKE_AGENTS_MAX, triggersOfModule, wakeKeyOf } from "./agent-schedules.policy"
import type { EventClaim, InstallationChange, InternalEventFact } from "./agent-schedules.contracts"

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
            const rows = await this.triggers.enabledForEvent(fact.workspaceId, fact.eventName, EVENT_WAKE_AGENTS_MAX)
            const firstPerAgent = rows.filter(
                (row, at) => rows.findIndex((other) => other.agentId === row.agentId) === at,
            )
            await eachInOrder(firstPerAgent, (trigger) =>
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
