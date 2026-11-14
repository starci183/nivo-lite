import { Injectable, Optional } from "@nestjs/common"
import { BrainFactEmbeddingsService, type EmbeddingIdentity, type WantingArm } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { VectorSyncService } from "@modules/domain/vector-sync"
import { InjectAi, type AiService } from "@modules/integrations/ai"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { BrainLogEvent } from "./brain.log-events"
import type { EmbeddingsRefreshed } from "./fact-embeddings.contracts"
import { NOTHING_REFRESHED } from "./fact-embeddings.policy"
import { FactEmbeddingsService } from "./fact-embeddings.service"

/** The facts one sweep page reads (keyset by id): four embedding calls' worth. */
const SWEEP_PAGE = 128

/**
 * The most facts one sweep of a workspace looks at (its budget): about 32 embedding calls. A workspace with more left over is visited
 * again by the next tick (it still has a fact in force with no vector), so nothing is dropped and a run never holds the worker long.
 */
const SWEEP_BUDGET = 1024

/** The most workspaces one timed sweep visits; the rest wait for the next tick. */
const SWEEP_WORKSPACES = 50

/** What one sweep of a workspace did. */
export interface EmbeddingsSwept extends EmbeddingsRefreshed {
    /** The budget ran out or an embedding call failed with facts maybe left: the next tick goes on (no fact is dropped). */
    readonly more: boolean
}

/** What one timed sweep across workspaces did. */
export interface VectorsSwept {
    /** Workspaces visited. */
    readonly workspaces: number
    /** Facts that got a vector from an embedding call. */
    readonly embedded: number
    /** Facts that took the vector of the same line from another row. */
    readonly copied: number
    /** Workspaces left with facts to do (the budget or a failed call); the next tick visits them again. */
    readonly more: number
}

/** Where one arm of a sweep stands after its pages: what they did, the budget left, and whether a call failed. */
interface ArmSwept extends EmbeddingsRefreshed {
    /** Facts the budget still allows. */
    readonly left: number
    /** An embedding call answered nothing: the sweep stops here. */
    readonly stopped: boolean
}

/** One arm of a sweep: which facts, after which id, within how many. */
interface ArmPage {
    /** No vector yet, or another identity's. */
    readonly arm: WantingArm
    /** The keyset cursor: the last id of the page before, null for the first page. */
    readonly afterId: string | null
    /** Facts the budget still allows. */
    readonly left: number
}

/** A sweep of one workspace that did nothing. */
const NOTHING_SWEPT: EmbeddingsSwept = { ...NOTHING_REFRESHED, more: false }

/** A timed sweep that visited nothing. */
const NO_WORKSPACE_SWEPT: VectorsSwept = { workspaces: 0, embedded: 0, copied: 0, more: 0 }

/** Adds what one page did to what the pages after it did. */
const plus = (one: EmbeddingsRefreshed, other: EmbeddingsRefreshed): EmbeddingsRefreshed => ({
    embedded: one.embedded + other.embedded,
    copied: one.copied + other.copied,
    unchanged: one.unchanged + other.unchanged,
})

@Injectable()
/**
 * The timed sweep of the truth graph's vectors (tick `brain-upkeep`, after the facts' own upkeep): every fact in force with no vector,
 * or with a vector of another identity, gets one, at any size of the graph. The announcement of a write embeds only the facts it names
 * and at most one call's worth (`FactEmbeddingsService.factsChanged`); this is where everything else is caught up: the rest of a bulk
 * apply, a failed or skipped inline call, a write made in a process with no vector listener. Reads go in keyset pages by id on the
 * partial index `brain_facts_active_unembedded` (migration 20261112015100), so N facts cost N / 128 reads and N / 32 embedding calls,
 * never a scan of the workspace per fact.
 */
export class FactVectorsSweepService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectLogger() private readonly logger: Logger,
        private readonly vectors: BrainFactEmbeddingsService,
        private readonly embeddings: FactEmbeddingsService,
        private readonly usage: UsageMeterService,
        @Optional() private readonly sync?: VectorSyncService,
    ) {}

    /**
     * Every workspace that holds a fact in force with no vector (one read on the partial index, at most `SWEEP_WORKSPACES`) is swept
     * within its budget. Never throws.
     */
    async sweep(): Promise<VectorsSwept> {
        try {
            if (!this.ai.available()) return NO_WORKSPACE_SWEPT
            // Vectors in the vector index: the catch-up is the reconcile's (tick `vector-reconcile`), which walks every row against its
            // point. This sweep reads the pgvector column, which stays empty for new facts there, so it would embed them again each tick.
            if (this.sync?.bound() === true) return NO_WORKSPACE_SWEPT
            const due = await this.vectors.workspacesWanting(SWEEP_WORKSPACES)
            const total = { embedded: 0, copied: 0, more: 0 }
            await eachInOrder(due, async (workspaceId) => {
                // The credit pool is checked before the workspace's embedding calls (a sweep is bulk work): an empty pool waits, counted
                // as `more`, and the first tick after credits return goes on (nothing is dropped).
                if (await this.usage.blockedBy(workspaceId, "embedding", true)) {
                    total.more += 1
                    this.logger.info(BrainLogEvent.VectorsBlockedCredits, { workspaceId })
                    return
                }
                const done = await this.refresh(workspaceId)
                total.embedded += done.embedded
                total.copied += done.copied
                if (done.more) total.more += 1
            })
            const swept: VectorsSwept = { workspaces: due.length, ...total }
            this.logger.info(BrainLogEvent.VectorsSwept, { ...swept })
            return swept
        } catch (cause) {
            this.logger.error(BrainLogEvent.VectorsSweepFailed, cause, {})
            return NO_WORKSPACE_SWEPT
        }
    }

    /**
     * The sweep of one workspace: EVERY fact in force that has no vector, then every one whose vector another identity made, in keyset
     * pages of `SWEEP_PAGE` by id (one read per page, one embedding call per 32 lines, one write per batch), until none is left or
     * `budget` facts were looked at; a workspace with more left is visited again by the next tick. An embedding call that answers
     * nothing stops the sweep (the next tick tries again). A failure is logged; it never throws.
     */
    async refresh(workspaceId: string, budget: number = SWEEP_BUDGET): Promise<EmbeddingsSwept> {
        try {
            if (!this.ai.available()) return NOTHING_SWEPT
            const identity = this.embeddings.identity()
            const missing = await this.pages(workspaceId, identity, {
                arm: "missing",
                afterId: null,
                left: Math.max(0, budget),
            })
            if (missing.stopped) return { ...plus(missing, NOTHING_REFRESHED), more: true }
            const other = await this.pages(workspaceId, identity, {
                arm: "other_identity",
                afterId: null,
                left: missing.left,
            })
            return { ...plus(missing, other), more: other.stopped || other.left === 0 }
        } catch (cause) {
            this.logger.error(BrainLogEvent.EmbeddingsFailed, cause, { workspaceId })
            return NOTHING_SWEPT
        }
    }

    /** One page of an arm, then the next after its last id, while the budget allows, the pages are full and no call failed. */
    private async pages(workspaceId: string, identity: EmbeddingIdentity, page: ArmPage): Promise<ArmSwept> {
        const asked = Math.min(SWEEP_PAGE, page.left)
        if (asked <= 0) return { ...NOTHING_REFRESHED, left: page.left, stopped: false }
        const states = await this.vectors.wanting(workspaceId, identity, {
            arm: page.arm,
            afterId: page.afterId,
            limit: asked,
        })
        if (states.length === 0) return { ...NOTHING_REFRESHED, left: page.left, stopped: false }
        const done = await this.embeddings.embedLines(workspaceId, states)
        const left = page.left - states.length
        const last = states.at(-1)?.fact.id ?? null
        if (done.stopped || states.length < asked || last === null)
            return { ...plus(done, NOTHING_REFRESHED), left, stopped: done.stopped }
        const rest = await this.pages(workspaceId, identity, { arm: page.arm, afterId: last, left })
        return { ...plus(done, rest), left: rest.left, stopped: rest.stopped }
    }
}
