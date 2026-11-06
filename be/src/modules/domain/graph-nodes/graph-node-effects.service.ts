import { Injectable } from "@nestjs/common"
import type { EffectCall, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import type { EffectAct } from "./graph-nodes.contracts"
import { GraphNodesLogEvent } from "./graph-nodes.log-events"

/** The ledger key of a call: its business key when the node named one, else the run step's own. */
export const ledgerKeyOf = (call: EffectCall): string =>
    call.dedupeKey === null ? `call:${call.key}` : `dedupe:${call.dedupeKey}`

/** The entity of the ledger. */
const LEDGER = "agent.node-effect"

/** The cursor scope of the ledger lookup (it never pages past its one row). */
const LOOKUP_SCOPE = cursorScopeOf("graph-nodes.effect", {}, "id")

/** The subject a ledger record kept: the data kind and the id of the record the first run touched. */
const subjectOf = (data: Readonly<Record<string, unknown>>): SubjectRef | null =>
    typeof data.subjectEntity === "string" && typeof data.subjectId === "string"
        ? { kind: data.subjectEntity, id: data.subjectId }
        : null

/** The lookup of one ledger key. */
const lookupOf = (ledgerKey: string): Query => ({
    from: LEDGER,
    select: ["subjectEntity", "subjectId"],
    where: { op: "eq", field: "effectKey", value: ledgerKey },
    order: [["id", "asc"]],
    page: { size: 1 },
})

@Injectable()
/**
 * The ledger that makes a node's effect act once, kept as `agent.node-effect` records through the entity engine. Before acting, a key
 * already written answers its subject; the act itself runs outside any transaction (an effect may call a door, BE-PERSISTENCE-6); after
 * acting, the subject is written once under the entity's unique key, and when two runs raced, both answer the subject of the record that
 * won.
 */
export class GraphNodeEffectsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly mutations: EntityMutationService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Runs the act once per key in the workspace and answers the subject the first run touched. */
    async once(workspaceId: string, effect: string, call: EffectCall, act: EffectAct): Promise<SubjectRef> {
        const ledgerKey = ledgerKeyOf(call)
        const before = await this.recorded(workspaceId, ledgerKey)
        if (before !== null) {
            this.logger.info(GraphNodesLogEvent.EffectReplayed, { workspaceId, effect })
            return before
        }
        const subject = await act()
        const written = await this.engine.scoped(workspaceId, (tx) =>
            this.mutations.mutate(
                tx,
                {
                    op: "insert",
                    entity: LEDGER,
                    values: {
                        effectKey: ledgerKey,
                        effectId: effect,
                        subjectEntity: subject.kind,
                        subjectId: subject.id,
                    },
                },
                "job",
            ),
        )
        if (written.ok) return subject
        const winner = written.reason === "taken" ? await this.recorded(workspaceId, ledgerKey) : null
        if (winner === null) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.EffectNotRecorded, params: { effect } })
        }
        return winner
    }

    /** The subject the ledger kept for a key, or null when the key is not written. */
    private async recorded(workspaceId: string, ledgerKey: string): Promise<SubjectRef | null> {
        const page = await this.engine.scoped(workspaceId, (tx) =>
            this.engine.list(tx, lookupOf(ledgerKey), LOOKUP_SCOPE),
        )
        const [first] = page.rows
        return first === undefined ? null : subjectOf(first.row.data)
    }
}
