import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { isRefused } from "@nivo-lite/agent-sdk/node"
import type { EffectCall, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { cursorScopeOf } from "@nivo-lite/agent-sdk/query"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import type { EffectAct } from "./graph-nodes.contracts"
import { GraphNodesLogEvent } from "./graph-nodes.log-events"

/** The longest key the ledger keeps (`agent.node-effect.effectKey`). */
const KEY_MAX = 200

/**
 * The ledger key of a call: its business key when the node named one, else the run step's own (the step, then a digest of the effect
 * and its arguments, which the runner makes). A key too long for the ledger is kept as its digest: the same call gives the same digest.
 */
export const ledgerKeyOf = (call: EffectCall): string => {
    const key = call.dedupeKey === null ? `call:${call.key}` : `dedupe:${call.dedupeKey}`
    return key.length <= KEY_MAX ? key : `digest:${createHash("sha256").update(key).digest("hex")}`
}

/** The entity of the ledger. */
const LEDGER = "agent.node-effect"

/** The cursor scope of the ledger lookup (it never pages past its one row). */
const LOOKUP_SCOPE = cursorScopeOf("graph-nodes.effect", {}, "id")

/** What the ledger kept under a key: the effect that ran and the subject it touched. */
interface Kept {
    /** The effect the key was written by. */
    readonly effect: string
    /** The data kind and the id of the record the first run touched. */
    readonly subject: SubjectRef
}

/** What a ledger record kept, or null for a record that holds no subject. */
const keptOf = (data: Readonly<Record<string, unknown>>): Kept | null =>
    typeof data.effectId === "string" && typeof data.subjectEntity === "string" && typeof data.subjectId === "string"
        ? { effect: data.effectId, subject: { kind: data.subjectEntity, id: data.subjectId } }
        : null

/** The lookup of one ledger key. */
const lookupOf = (ledgerKey: string): Query => ({
    from: LEDGER,
    select: ["effectId", "subjectEntity", "subjectId"],
    where: { op: "eq", field: "effectKey", value: ledgerKey },
    order: [["id", "asc"]],
    page: { size: 1 },
})

@Injectable()
/**
 * The ledger that makes a node's effect act once, kept as `agent.node-effect` records through the entity engine. Before acting, a key
 * already written answers its subject; the act itself runs outside any transaction (an effect may call a door, BE-PERSISTENCE-6); after
 * acting, the subject is written once under the entity's unique key, and when two runs raced, both answer the subject of the record that
 * won. A refusal (`{ kind: "refused" }`) is never written: it changed nothing, and a kept refusal would be replayed for ever. A key
 * answers only the effect that wrote it: a key another effect holds is refused before anything acts, so one tool's result is never
 * handed to another.
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
            if (before.effect !== effect) {
                throw new GraphNodesError({
                    code: GraphNodesErrorCode.EffectKeyTaken,
                    params: { effect, heldBy: before.effect },
                })
            }
            this.logger.info(GraphNodesLogEvent.EffectReplayed, { workspaceId, effect })
            return before.subject
        }
        const subject = await act()
        // A refusal is an answer, not an act: nothing is kept under the key, so the call asked again later is really made again.
        if (isRefused(subject)) return subject
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
        if (winner === null || winner.effect !== effect) {
            throw new GraphNodesError({ code: GraphNodesErrorCode.EffectNotRecorded, params: { effect } })
        }
        return winner.subject
    }

    /** What the ledger kept for a key, or null when the key is not written. */
    private async recorded(workspaceId: string, ledgerKey: string): Promise<Kept | null> {
        const page = await this.engine.scoped(workspaceId, (tx) =>
            this.engine.list(tx, lookupOf(ledgerKey), LOOKUP_SCOPE),
        )
        const [first] = page.rows
        return first === undefined ? null : keptOf(first.row.data)
    }
}
