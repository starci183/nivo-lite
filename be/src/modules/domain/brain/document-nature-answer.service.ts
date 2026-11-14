import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import type { FounderNature, NatureOverride } from "./document-nature.policy"
import { DocumentPartsService } from "./document-parts.service"
import { FactReadingLogEvent } from "./fact-reading.log-events"
import { FOUNDER } from "./founder.policy"

/** What the founder's answer changed: the document's parts it was saved on, and how many readings went back to triage. */
export interface NatureAnswered {
    /** The document the answer names. */
    readonly id: string
    /** The parts of the document (the first part first). */
    readonly parts: ReadonlyArray<string>
    /** How many of their readings were opened again (a running one takes the answer at its own next triage). */
    readonly reopened: number
}

@Injectable()
/**
 * The founder's answer on WHAT A DOCUMENT IS (TRIAGE-2): `rules` makes every passage of it rule material (triaged and read into truths
 * as before); `records`, `log` or `reference` make it file no truth (what it supported is withdrawn at its next triage, a truth in force
 * left with no evidence becomes a proposal to retire); null takes the answer back (the model's reading stands). The answer covers every
 * part of a long file, opens their readings again at triage and queues their jobs in ONE transaction. The founder alone answers: the
 * answer decides what may go in force.
 */
export class DocumentNatureAnswerService {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly queue: KnowledgeQueue,
        private readonly extractions: BrainExtractionsService,
        private readonly parts: DocumentPartsService,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** Saves the founder's answer on a document (any of its parts names it) and has every part triaged again with it (the door checks the closed list). */
    async answer(userId: string, workspaceId: string, sourceId: string, nature: FounderNature): Promise<NatureAnswered> {
        const founder = await this.members.require(userId, workspaceId, FOUNDER)
        const parts = await this.parts.wholeOf(workspaceId, sourceId)
        const at = this.clock.now().toISOString()
        const override: NatureOverride | null = nature === undefined ? null : { nature, by: founder.displayName, at }
        const reopened = await this.entityManager.transaction(async (tx) => {
            const opened = await this.extractions.overrideNature(workspaceId, parts, override === null ? null : { ...override }, tx)
            await eachInOrder(opened, (id) => this.queue.enqueueFactsNext({ sourceId: id, workspaceId }, tx, `nature:${at}`))
            return opened.length
        })
        this.logger.info(FactReadingLogEvent.NatureAnswered, { sourceId, parts: parts.length, reopened, nature: nature ?? "model" })
        return { id: sourceId, parts, reopened }
    }
}
