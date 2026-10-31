import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectAgentTurnQueue } from "@modules/queues/agent-turn"
import type { AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { defaultSettings, defaultState, toSettingsRecord, toStateRecord } from "./agent-work.mapper"
import { restoresHeldWake } from "./agent-work.policy"
import { AgentWorkError, AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentWakeEntity, AgentWorkSettingsEntity, AgentWorkStateEntity } from "./persistence/entities"
import type { AgentRoad, AgentWorkSettingsRecord, AgentWorkState } from "./agent-work.contracts"

/** The most held wakes one restore pass moves. */
const RESTORE_PAGE = 500

/** The most passes a restore makes, so a switch never runs away on a workspace with a backlog of millions. */
const RESTORE_PASSES = 20

/** One row of the switch function. */
interface SwitchRow {
    /** True when the agent is the workspace's and the switch was written. */
    readonly agent_work_switch?: unknown
}

@Injectable()
/**
 * The kill switches and the road. Work can be switched off for one agent or for a workspace, by an owner only. A switch takes effect at
 * the next turn: the database refuses to begin one, and wakes that arrive meanwhile are held, never dropped. Switching on again
 * moves the customer and tag wakes under a day old back to the queue and skips the rest.
 */
export class AgentWorkSettingsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectAgentTurnQueue() private readonly queue: AgentTurnQueue,
        private readonly access: AgentWorkAccessService,
    ) {}

    /** The settings of a workspace; the defaults while it has no row. */
    async settingsOf(workspaceId: string): Promise<AgentWorkSettingsRecord> {
        const row = await this.entityManager.findOne(AgentWorkSettingsEntity, { where: { workspaceId } })
        return row === null ? defaultSettings(workspaceId) : toSettingsRecord(row)
    }

    /** The road of a workspace's customer intake. */
    async roadOf(workspaceId: string): Promise<AgentRoad> {
        return (await this.settingsOf(workspaceId)).road
    }

    /** The work state of an agent: its switch, breaker and the day's count; the defaults while it has no row. */
    async stateOf(agentId: string): Promise<AgentWorkState> {
        const row = await this.entityManager.findOne(AgentWorkStateEntity, { where: { agentId } })
        return row === null ? defaultState(agentId) : toStateRecord(row)
    }

    /** Switches work on or off for every agent of the workspace. Owner only. */
    async setWorkspaceWork(userId: string, workspaceId: string, enabled: boolean): Promise<AgentWorkSettingsRecord> {
        const seat = await this.access.owner(userId, workspaceId)
        await this.entityManager.transaction(async (tx) => {
            await tx.upsert(
                AgentWorkSettingsEntity,
                {
                    workspaceId,
                    workEnabled: enabled,
                    pausedBy: enabled ? null : seat,
                    pausedAt: enabled ? null : this.clock.now(),
                },
                ["workspaceId"],
            )
            if (enabled) await this.restore(tx, { workspaceId })
        })
        return this.settingsOf(workspaceId)
    }

    /** Switches work on or off for one agent. Owner only. */
    async setAgentWork(
        userId: string,
        workspaceId: string,
        agentId: string,
        enabled: boolean,
    ): Promise<AgentWorkState> {
        const seat = await this.access.owner(userId, workspaceId)
        await this.entityManager.transaction(async (tx) => {
            const [row] = await callDbFunction<SwitchRow>(tx, "public.agent_work_switch", [
                workspaceId,
                agentId,
                enabled,
                seat,
            ])
            if (row?.agent_work_switch !== true) throw new AgentWorkError({ code: AgentWorkErrorCode.AgentNotFound })
            if (enabled) await this.restore(tx, { agentId })
        })
        return this.stateOf(agentId)
    }

    /** Moves the wakes a switch held back to the queue (customer and tag, under a day old) or to skipped, a page at a time. */
    private async restore(tx: EntityManager, scope: FindOptionsWhere<AgentWakeEntity>): Promise<void> {
        await this.restorePage(tx, scope, this.clock.now(), RESTORE_PASSES)
    }

    private async restorePage(
        tx: EntityManager,
        scope: FindOptionsWhere<AgentWakeEntity>,
        now: Date,
        passesLeft: number,
    ): Promise<void> {
        if (passesLeft === 0) return
        const held = await tx.find(AgentWakeEntity, {
            where: { ...scope, status: "held", reason: "killed" },
            order: { createdAt: "ASC" },
            take: RESTORE_PAGE,
        })
        if (held.length === 0) return
        const runnable = held.filter((wake) => restoresHeldWake(wake.source, wake.createdAt, now))
        const stale = held.filter((wake) => !runnable.includes(wake))
        await this.move(tx, runnable, { status: "pending", reason: null })
        await this.move(tx, stale, { status: "skipped", reason: "stale", finishedAt: now })
        await this.drainScopes(tx, runnable, now)
        await this.restorePage(tx, scope, now, passesLeft - 1)
    }

    private async move(
        tx: EntityManager,
        wakes: ReadonlyArray<AgentWakeEntity>,
        change: Partial<Pick<AgentWakeEntity, "status" | "reason" | "finishedAt">>,
    ): Promise<void> {
        if (wakes.length === 0) return
        await tx.update(AgentWakeEntity, { id: In(wakes.map((wake) => wake.id)) }, change)
    }

    /** Starts one drain per distinct agent and scope among the restored wakes. */
    private async drainScopes(tx: EntityManager, wakes: ReadonlyArray<AgentWakeEntity>, now: Date): Promise<void> {
        const scopes = new Map(wakes.map((wake) => [`${wake.agentId}|${wake.scopeKey}`, wake] as const))
        await eachInOrder(scopes.values(), (wake) =>
            this.queue.enqueueSweepDrain(
                { workspaceId: wake.workspaceId, agentId: wake.agentId, scopeKey: wake.scopeKey },
                now,
                tx,
            ),
        )
    }
}
