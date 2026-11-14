import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ToolGrantsLogEvent } from "./tool-grants.log-events"
import type { NodeRightsFlip, NodeRightsSwitchView } from "./tool-grants.contracts"
import { NodeRightsSwitchEntity } from "./persistence/entities"

/** After a read of the switch failed, how long every workspace is answered `off` before the store is asked again. */
const UNREADABLE_PAUSE_MS = 30_000

/** The switch of a workspace that has no row: off, never flipped. */
const OFF: Omit<NodeRightsSwitchView, "workspaceId"> = { decides: false, forced: false, compared: 0, differed: 0, flippedAt: null }

@Injectable()
/**
 * The per-workspace switch "node rights decide": the one reader and writer of public.node_rights_switches. Off, or no row, is the
 * state of every workspace until a person flips it from the command line: the agent's ticks decide every call, exactly as before.
 * On: a call made inside a workflow node is decided by the node's policy rows (the gateway's judge asks `decides`). The reader never
 * fails a call: a switch that cannot be read (the table of an unapplied migration, a refused query) is off, logged once per pause.
 * The switch is read on every judged call and never cached while it reads, so a flip and its rollback bite on the next call.
 */
export class NodeRightsSwitchService {
    private unreadableUntil = 0

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** True when the node's rows decide the calls a workflow node of the workspace makes; false with no row, off, or unreadable. */
    async decides(workspaceId: string): Promise<boolean> {
        const now = this.clock.now().getTime()
        if (now < this.unreadableUntil) return false
        try {
            const row = await this.entityManager.findOne(NodeRightsSwitchEntity, {
                select: { decides: true },
                where: { workspaceId },
            })
            return row?.decides === true
        } catch (cause: unknown) {
            // Off is today's behaviour, so a store that cannot answer never changes a decision; asked again after the pause.
            this.unreadableUntil = now + UNREADABLE_PAUSE_MS
            this.logger.error(ToolGrantsLogEvent.NodeRightsSwitchUnreadable, cause, { workspaceId })
            return false
        }
    }

    /** The switch of a workspace as stored, with the figures its last flip read; a workspace with no row is off. Fails when the store does. */
    async stateOf(workspaceId: string): Promise<NodeRightsSwitchView> {
        const row = await this.entityManager.findOne(NodeRightsSwitchEntity, { where: { workspaceId } })
        if (row === null) return { workspaceId, ...OFF }
        return {
            workspaceId,
            decides: row.decides,
            forced: row.forced,
            compared: Number(row.compared),
            differed: Number(row.differed),
            flippedAt: row.updatedAt,
        }
    }

    /** Turns the switch of a workspace on or off and keeps what the flip read of the shadow compare; one row per workspace. */
    async flip(flip: NodeRightsFlip): Promise<void> {
        await this.entityManager.upsert(
            NodeRightsSwitchEntity,
            {
                workspaceId: flip.workspaceId,
                decides: flip.decides,
                forced: flip.forced,
                compared: String(flip.compared),
                differed: String(flip.differed),
            },
            ["workspaceId"],
        )
        this.logger.info(ToolGrantsLogEvent.NodeRightsSwitchFlipped, { ...flip })
    }
}
