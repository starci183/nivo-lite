import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalAgentId, ProviderTriggerDeciderReader, TriggerRole } from "./provider-triggers.contracts"
import { ProviderTriggerDeadEventEntity, ProviderTriggerSwitchEntity } from "./persistence/entities"

/** The most switches one account's read looks at: a provider declares a handful of triggers. */
const SWITCHES_MAX = 50

/** A run that could not be started. */
export interface DeadEvent {
    /** The workspace. */
    readonly workspaceId: string
    /** The account. */
    readonly connectionId: string
    /** The trigger name. */
    readonly triggerName: string
    /** The agent the run was for. */
    readonly agentId: string
    /** Its part. */
    readonly role: TriggerRole
    /** The key of the wake. */
    readonly eventKey: string
    /** Why, as a code. */
    readonly reason: string
    /** The params of the run. */
    readonly params: Readonly<Record<string, unknown>>
}

/** What a change of a switch writes; a member left out keeps what the row holds. */
export interface SwitchChange {
    /** Whether it is on. */
    readonly enabled?: boolean
    /** The start point. */
    readonly enabledAt?: Date | null
    /** The bound decider. */
    readonly deciderAgentId?: string | null
}

@Injectable()
/**
 * The only writer of `public.provider_trigger_switches` (the switch of each trigger on each account, its start point, its bound
 * decider and when it last fired) and of `public.provider_trigger_dead_events` (the runs a trigger could not start). It holds ids,
 * counts and times, never a payload's content.
 */
export class ProviderTriggerStoreService implements ProviderTriggerDeciderReader {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The switch of one trigger on one account, or null when the owner never touched it (off). */
    find(manager: EntityManager, connectionId: string, triggerName: string): Promise<ProviderTriggerSwitchEntity | null> {
        return manager.findOne(ProviderTriggerSwitchEntity, { where: { connectionId, triggerName } })
    }

    /** The agent the owner bound as the decider of one trigger on one account, or null (none bound, or the trigger never touched). */
    async boundDeciderOf(
        connectionId: string,
        triggerName: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalAgentId> {
        const held = await manager.findOne(ProviderTriggerSwitchEntity, {
            select: { id: true, deciderAgentId: true },
            where: { connectionId, triggerName },
        })
        return held?.deciderAgentId ?? null
    }

    /** The switches of one account of the workspace. */
    listOf(workspaceId: string, connectionId: string): Promise<ReadonlyArray<ProviderTriggerSwitchEntity>> {
        return this.entityManager.find(ProviderTriggerSwitchEntity, {
            where: { workspaceId, connectionId },
            order: { triggerName: "ASC" },
            take: SWITCHES_MAX,
        })
    }

    /** Writes a change of one switch: the row is made on the first change and updated after. */
    async change(workspaceId: string, connectionId: string, triggerName: string, change: SwitchChange): Promise<void> {
        await this.entityManager.upsert(
            ProviderTriggerSwitchEntity,
            { workspaceId, connectionId, triggerName, ...change },
            ["connectionId", "triggerName"],
        )
    }

    /** Records that the trigger handed `events` events on at `at`, on the caller's manager. */
    async markFired(manager: EntityManager, id: string, at: Date, events: number): Promise<void> {
        await manager.update(ProviderTriggerSwitchEntity, { id }, { lastFiredAt: at })
        await manager.increment(ProviderTriggerSwitchEntity, { id }, "firedCount", events)
    }

    /** Keeps a run that could not be started, once per wake key, on the caller's manager. */
    async keepDead(manager: EntityManager, dead: DeadEvent): Promise<void> {
        await manager.upsert(ProviderTriggerDeadEventEntity, { ...dead }, ["eventKey"])
    }
}
