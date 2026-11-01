import { Injectable } from "@nestjs/common"
import {
    BrainFactBatchService,
    BrainFactsReadService,
    BrainFactsService,
    batchIdOf,
    bulkNoteOf,
    isBulkSafe,
} from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { BulkApplied, BulkUndone } from "./brain.contracts"
import { BrainLogEvent } from "./brain.log-events"
import { BrainError, BrainErrorCode } from "./errors/brain.error"

/** Who may change the brain of a workspace. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The most facts one read answers: a document gives at most 200, and the read may hold other waiting ones. */
const GROUP_MAX = 2000

@Injectable()
/**
 * The safe path through a pile of waiting facts: the facts a document of the owner's own proposed, applied together by document with
 * one undo. Only facts the policy calls safe go (internal, quoted by the document, disagreeing with nothing in force, none waiting
 * against it); everything else stays for a person. A public document is refused, so nothing is ever published this way.
 */
export class BrainBulkService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        private readonly members: WorkspaceMembersService,
        private readonly sources: KnowledgeSourcesService,
        private readonly facts: BrainFactsService,
        private readonly reads: BrainFactsReadService,
        private readonly batches: BrainFactBatchService,
    ) {}

    /**
     * Applies the safe facts a document of the owner's proposed, as one batch. A document kept public is refused. A fact that was decided
     * since, or that has another waiting value or a value in force by now, is left for a person.
     */
    async applyDocument(userId: string, workspaceId: string, sourceId: string): Promise<BulkApplied> {
        const me = await this.members.require(userId, workspaceId, MANAGERS)
        const source = await this.sources.detail(userId, workspaceId, sourceId)
        if (source.visibility !== "internal") throw new BrainError({ code: BrainErrorCode.BulkNeedsInternal })
        const waiting = await this.reads.ofSources(workspaceId, [sourceId], ["proposed"], GROUP_MAX)
        const nowMs = this.clock.now().getTime()
        const safe = waiting.filter((fact) => isBulkSafe(fact, nowMs))
        const batchId = this.ids.next()
        const note = bulkNoteOf(batchId, source.title)
        const state = { applied: 0 }
        await eachInOrder(safe, async (fact) => {
            if (await this.applyOne(workspaceId, fact, me.displayName, note)) state.applied += 1
        })
        return { batchId, applied: state.applied, skipped: waiting.length - state.applied }
    }

    /** Takes a batch back: its facts wait for review again. A fact changed since stays as it is. */
    async undoBatch(userId: string, workspaceId: string, batchId: string): Promise<BulkUndone> {
        await this.members.require(userId, workspaceId, MANAGERS)
        const active = await this.reads.list(workspaceId, { statuses: ["active"], limit: GROUP_MAX })
        const batch = active.filter((fact) => batchIdOf(fact.decisionNote) === batchId)
        const state = { restored: 0 }
        await eachInOrder(batch, async (fact) => {
            if (await this.batches.reopen(workspaceId, fact.id, batchId)) state.restored += 1
        })
        return { restored: state.restored, kept: batch.length - state.restored }
    }

    /** Applies one fact if nothing else waits for or holds its key; a failed write is logged and the fact is left for a person. */
    private async applyOne(workspaceId: string, fact: FactRecord, by: string, note: string): Promise<boolean> {
        try {
            const key = [workspaceId, fact.subjectKey, fact.attribute] as const
            const waiting = await this.facts.byKey(...key, "proposed", fact.installationId)
            const inForce = await this.facts.byKey(...key, "active", fact.installationId)
            if (waiting.length !== 1 || inForce.length > 0) return false
            await this.facts.apply(workspaceId, fact.id, by, note)
            return true
        } catch (cause) {
            this.logger.error(BrainLogEvent.BulkFactSkipped, cause, { factId: fact.id })
            return false
        }
    }
}
