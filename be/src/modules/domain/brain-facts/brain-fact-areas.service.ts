import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { BrainFactsReadService } from "./brain-facts-read.service"
import { BrainFactsService, type PublicSourcesOf } from "./brain-facts.service"
import type { FactRecord, FactStatus } from "./brain-facts.contracts"
import { areaNoteOf, founderChoseReaders, readersAfterMove, type MovedReaders } from "./fact-audience.policy"
import { BrainFactEntity } from "./persistence/entities"

/** The most truths one document's move re-labels per status group (the list's own bound applies too). */
const MOVE_MAX = 2000

/** The values of a truth that are not in force yet: a move writes their audience in place. */
const WAITING: ReadonlyArray<FactStatus> = ["scheduled", "proposed"]

/** The documents a truth was read from: the source of each of its document lines. */
const documentsOf = (fact: FactRecord): ReadonlyArray<string> =>
    fact.evidence.flatMap((item) => (item.kind === "document" ? [item.sourceId ?? item.ref] : []))

@Injectable()
/**
 * The truths of a document that MOVED between the two upload areas (owner 2026-11-12: "what you upload is what you get"; nothing is
 * inferred, no model and no word decides an audience).
 */
export class BrainFactAreasService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly facts: BrainFactsService,
        private readonly reads: BrainFactsReadService,
    ) {}

    /**
     * Every truth whose document evidence cites one of `sourceIds` (in force, scheduled or waiting) takes the audience of its documents
     * AFTER the move: public when at least one of them is in the public area (`publicOf`), else internal (`readersAfterMove`: the
     * founder's switch and his own statements keep theirs). A truth in force becomes its next version through the store's one audience
     * door (`BrainFactsService.reachFor`), decided by `movedBy` with a note naming the move (`areaNoteOf`): its history says who moved
     * it, when, and from which audience to which. A value not in force yet is no version: its audience is written in place, unless the
     * founder switched the audience of its key's value in force. Every changed row is announced, so the vector index follows.
     * Idempotent: asking again changes only what still differs. Answers the changed ids.
     */
    async followDocumentAreas(
        workspaceId: string,
        sourceIds: ReadonlyArray<string>,
        publicOf: PublicSourcesOf,
        movedBy: string,
        move: string,
    ): Promise<ReadonlyArray<string>> {
        const changed: Array<string> = []
        const targetOf = async (fact: FactRecord): Promise<MovedReaders> => {
            const open = await publicOf([...new Set(documentsOf(fact))])
            return readersAfterMove(
                fact,
                documentsOf(fact).some((id) => open.has(id)),
            )
        }
        const inForce = await this.reads.ofSources(workspaceId, sourceIds, ["active"], MOVE_MAX)
        await eachInOrder(inForce, async (fact) => {
            const to = await targetOf(fact)
            if (to === null) return
            const next = await this.facts.reachFor(workspaceId, fact, to, movedBy, areaNoteOf(fact, to, move))
            changed.push(fact.id, next.id)
        })
        // Read after the versions above: their audience door gave the values of the same key theirs; each now takes its own documents'.
        const waiting = await this.reads.ofSources(workspaceId, sourceIds, WAITING, MOVE_MAX)
        await eachInOrder(waiting, async (fact) => {
            const to = await targetOf(fact)
            if (to === null || (await this.keySwitched(workspaceId, fact))) return
            await this.entityManager.update(
                BrainFactEntity,
                { workspaceId, id: fact.id, status: In([...WAITING]) },
                { scope: to.scope, modules: [...to.modules] },
            )
            changed.push(fact.id)
        })
        await this.facts.announceChanged(workspaceId, changed)
        return changed
    }

    /** Whether the founder set the audience of the value in force of this fact's key with his switch (its waiting values follow it). */
    private async keySwitched(workspaceId: string, fact: FactRecord): Promise<boolean> {
        const [active] = await this.reads.keyed(
            this.entityManager,
            workspaceId,
            fact.subjectKey,
            fact.attribute,
            "active",
            fact.installationId,
        )
        return active !== undefined && founderChoseReaders(active)
    }
}
