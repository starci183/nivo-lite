import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { EffectCall, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GraphNodesLogEvent } from "./graph-nodes.log-events"
import { GraphNodeEffectEntity } from "./persistence/entities"

/** The ledger key of a call: its business key when the node named one, else the run step's own. */
export const ledgerKeyOf = (call: EffectCall): string =>
    call.dedupeKey === null ? `call:${call.key}` : `dedupe:${call.dedupeKey}`

@Injectable()
/**
 * The ledger that makes a node's effect act once. Before acting, a key already written answers its subject; after acting, the subject
 * is written once, and when two runs raced, both answer the subject of the row that won.
 */
export class GraphNodeEffectsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Runs the act once per key in the workspace and answers the subject the first run touched. */
    async once(
        workspaceId: string,
        effect: string,
        call: EffectCall,
        act: () => Promise<SubjectRef>,
    ): Promise<SubjectRef> {
        const ledgerKey = ledgerKeyOf(call)
        const before = await this.entityManager.findOneBy(GraphNodeEffectEntity, { workspaceId, ledgerKey })
        if (before !== null) {
            this.logger.info(GraphNodesLogEvent.EffectReplayed, { workspaceId, effect })
            return { kind: before.subjectKind, id: before.subjectId }
        }
        const subject = await act()
        await this.entityManager
            .createQueryBuilder(GraphNodeEffectEntity, "effect")
            .insert()
            .into(GraphNodeEffectEntity)
            .values({ workspaceId, ledgerKey, effect, subjectKind: subject.kind, subjectId: subject.id })
            .orIgnore()
            .execute()
        const row = await this.entityManager.findOneByOrFail(GraphNodeEffectEntity, { workspaceId, ledgerKey })
        return { kind: row.subjectKind, id: row.subjectId }
    }
}
