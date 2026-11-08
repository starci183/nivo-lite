import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentEventWakesService, type EventTarget } from "@modules/domain/agent-schedules"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentWakeService, AgentWorkAccessService, type AgentWake } from "@modules/domain/agent-work"
import { encodeInbound } from "@modules/domain/agent-wake-rules"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectInboundAdapterRegistry, InjectInboundStopReporter } from "./agent-inbound.decorators"
import { AgentInboundLogEvent } from "./agent-inbound.log-events"
import { AgentInboundError, AgentInboundErrorCode } from "./errors/agent-inbound.error"
import { stepChain } from "./inbound-chain.policy"
import { memberOf, payloadFits, wakeInboundOf } from "./inbound-event.policy"
import type { InboundAdapterRegistry } from "./agent-inbound.port"
import type { InboundAccepted, InboundAdapter, InboundEvent } from "./agent-inbound.contracts"
import type { InboundChainStep, InboundStop, InboundStopReporter } from "./agent-inbound-door.contracts"

@Injectable()
/**
 * The one door everything that wakes an agent goes through. The adapter that normalized the event is looked up by key; the agents it wakes are
 * the ones the event names or, with no name, the ones holding an enabled event trigger for its type and source (the matcher of
 * `AgentEventWakesService`, not a second one). Each wake is written through `AgentWakeService` with the normalized event in its context, keyed by
 * the event's idempotency key, and the run of the wake opens with it, all in the caller's transaction and so through the outbox: a redelivery
 * is one wake and one run. A tag between agents carries a chain; waking an agent past the chain's limit writes nothing and tells a person.
 */
export class InboundDoorService {
    constructor(
        @InjectIds() private readonly ids: Ids,
        @InjectLogger() private readonly logger: Logger,
        @InjectInboundAdapterRegistry() private readonly registry: InboundAdapterRegistry,
        private readonly events: AgentEventWakesService,
        private readonly access: AgentWorkAccessService,
        private readonly wakes: AgentWakeService,
        private readonly runs: AgentRunsService,
        @Optional() @InjectInboundStopReporter() private readonly reporter: InboundStopReporter | null = null,
    ) {}

    /** Delivers one event inside `tx`; answers which agents were woken. */
    async accept(tx: EntityManager, event: InboundEvent): Promise<InboundAccepted> {
        const adapter = this.registry.of(event.adapter)
        if (event.idempotencyKey === "") throw new AgentInboundError({ code: AgentInboundErrorCode.KeyMissing })
        if (!payloadFits(event.payload)) throw new AgentInboundError({ code: AgentInboundErrorCode.PayloadTooLarge })
        const targets = await this.targetsOf(event, adapter)
        if (targets.length === 0) this.logger.info(AgentInboundLogEvent.NoTarget, { adapter: adapter.key })
        const woken: Array<string> = []
        await eachInOrder(targets, async (target) => {
            if (await this.deliver(tx, event, adapter, target)) woken.push(target.agentId)
        })
        return { accepted: woken.length > 0, agentIds: woken }
    }

    private async targetsOf(event: InboundEvent, adapter: InboundAdapter): Promise<ReadonlyArray<EventTarget>> {
        if (event.agentId === null) return this.events.agentsFor(event.workspaceId, event.eventType, adapter.key)
        await this.access.agent(event.workspaceId, event.agentId)
        return [{ agentId: event.agentId, probeKey: null }]
    }

    /** Writes the wake and opens its run for one agent; false when the chain stopped or the wake already existed. */
    private async deliver(
        tx: EntityManager,
        event: InboundEvent,
        adapter: InboundAdapter,
        target: EventTarget,
    ): Promise<boolean> {
        const step = stepChain(event.chain, target.agentId, () => this.ids.next())
        if (step.kind === "stop") {
            await this.stop(tx, event, target.agentId, step)
            return false
        }
        const inbound = wakeInboundOf(event, adapter, step.chain)
        const wake: AgentWake = {
            workspaceId: event.workspaceId,
            agentId: target.agentId,
            source: adapter.key,
            eventKey: event.idempotencyKey,
            context: {
                ...adapter.wakeContextOf?.(event),
                eventName: event.eventType,
                inbound: encodeInbound(inbound),
                ...(target.probeKey === null ? {} : { probeKey: target.probeKey }),
            },
            actorMemberId: memberOf(event),
            ...(event.scopeKey === null ? {} : { scopeKey: event.scopeKey }),
        }
        const wakeId = await this.wakes.write(tx, wake)
        if (wakeId === null) return false
        await this.runs.open(tx, {
            workspaceId: event.workspaceId,
            agentId: target.agentId,
            wakeId,
            trigger: event.eventType,
            versionId: null,
            context: { adapter: adapter.key, idempotencyKey: event.idempotencyKey, inbound },
        })
        this.logger.info(AgentInboundLogEvent.Woke, { adapter: adapter.key, agentId: target.agentId, wakeId })
        return true
    }

    private async stop(
        tx: EntityManager,
        event: InboundEvent,
        agentId: string,
        step: Extract<InboundChainStep, { readonly kind: "stop" }>,
    ): Promise<void> {
        const stop: InboundStop = {
            workspaceId: event.workspaceId,
            agentId,
            chainId: step.chain.id,
            depth: step.chain.depth,
            agentIds: step.chain.agentIds,
            reason: step.reason,
            adapter: event.adapter,
            eventType: event.eventType,
            idempotencyKey: event.idempotencyKey,
        }
        this.logger.warn(AgentInboundLogEvent.ChainStopped, { agentId, chainId: stop.chainId, reason: step.reason })
        if (this.reporter === null) throw new AgentInboundError({ code: AgentInboundErrorCode.StopNotReportable })
        await this.reporter.report(tx, stop)
    }
}
