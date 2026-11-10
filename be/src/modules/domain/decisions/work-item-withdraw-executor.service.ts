import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/blocks-core"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { WorkEngineService } from "./work-engine.service"
import { undoPayloadSchema } from "./work-item-effects.schema"

/** The name under which a graph node closes work in the Office. */
const ACTOR = "NIVO"

@Injectable()
/**
 * The executor of the `work-item.withdraw` undo, which a failed run runs for the work item it raised: a work item still waiting for a
 * person is closed as rejected by the engine, with whatever undo its action has. One already decided (or gone) stays as it is.
 */
export class WorkItemWithdrawExecutorService implements OnModuleInit {
    constructor(
        private readonly engine: WorkEngineService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addExecutor({
            effect: TOOL.workItemWithdraw,
            execute: (turn, payload) => this.withdraw(turn, payload),
        })
    }

    private async withdraw(turn: NodeTurn, payload: EffectPayload): Promise<SubjectRef> {
        const { id } = undoPayloadSchema.parse(payload)
        try {
            await this.engine.resumeWork(
                { workspaceId: turn.workspaceId, actor: ACTOR, locale: turn.locale },
                id,
                "rejected",
                {},
                { name: ACTOR, kind: "staff" },
            )
        } catch (cause) {
            if (!(cause instanceof DecisionsError) || cause.code !== DecisionsErrorCode.NotWaiting) throw cause
        }
        return { kind: "work-item", id }
    }
}
