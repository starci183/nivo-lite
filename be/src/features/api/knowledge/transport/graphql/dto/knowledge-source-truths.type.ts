import { Field, Int, ObjectType } from "@nestjs/graphql"
import { KnowledgeSourceNatureType } from "./knowledge-source-nature.type"

@ObjectType()
/**
 * Where the truths of one document stand. A document is ready (searchable) before this work starts and whatever becomes of it: this
 * is the second life of the document, shown beside its status, never instead of it.
 */
export class KnowledgeSourceTruthsType {
    /**
     * `running`, `done`, `failed`, or one of the three waiting states: `blocked_credits` (the credit pool is empty),
     * `awaiting_critique` (its truths are filed and wait for the critic's verdict; nothing is in force yet), `at_ceiling` (the business
     * holds its ceiling of truths in force; the rest wait as proposals). A waiting reading goes on by itself. `legacy`: the document was
     * read before the passage stages (note `BRAIN_NOTE_READ_OLD_WAY`): its passage counts were never kept (they read 0, not "none
     * found"), `truthsFound` is what that reading filed, and "read again" (`reindexKnowledgeSource`) takes it through the stages.
     */
    @Field(() => String)
    state!: string

    /** The stage it is at: `triage` (which passages state a rule), `extract` (the truths of those), `settle` (what goes in force); null for a document read before the stages. */
    @Field(() => String, { nullable: true })
    stage?: string | null

    /** A stored code of why it stopped or waits (`BRAIN_NOTE_*`, `KNOWLEDGE_NOTE_NO_CREDITS_FACTS`), or null. */
    @Field(() => String, { nullable: true })
    note?: string | null

    /** The passages of the document. */
    @Field(() => Int)
    passagesTotal!: number

    /** The passages triage has judged. */
    @Field(() => Int)
    passagesTriaged!: number

    /** The passages that state a rule of the shop: only these are read into truths. */
    @Field(() => Int)
    passagesKept!: number

    /** Reading calls done. */
    @Field(() => Int)
    callsDone!: number

    /** Reading calls in all (known once triage is done). */
    @Field(() => Int)
    callsTotal!: number

    /** Truths filed from the document. */
    @Field(() => Int)
    truthsFound!: number

    /** Truths of the document put in force directly. */
    @Field(() => Int)
    truthsInForce!: number

    /** Truths the founder is asked about: a contradiction, or an open point of the critic about their passage. */
    @Field(() => Int)
    truthsAsked!: number

    /** Truths that wait: not the founder's document, not critiqued yet, or over the ceiling. */
    @Field(() => Int)
    truthsWaiting!: number

    /**
     * Reading calls skipped: their answer could not be read even after one follow-up; their passages are read again by the next reading
     * ("read again"). Note `BRAIN_NOTE_WINDOWS_SKIPPED` when the reading ended with any.
     */
    @Field(() => Int)
    callsSkipped!: number

    /** Answer lines refused (not a truth line, or a value its passage does not hold); note `BRAIN_NOTE_LINES_REFUSED` when nothing was filed. */
    @Field(() => Int)
    linesRefused!: number

    /**
     * Lines of rule passages neither read into a truth nor skipped by the reading, even after a follow-up (TRIAGE-3): kept in the
     * reading's notes, note `BRAIN_NOTE_LINES_UNREAD` when the reading ended with any. 0 for a reading before the count existed.
     */
    @Field(() => Int, { nullable: true })
    linesUnread?: number | null

    /** What the document is (TRIAGE-2): only rule material is read into truths; null while it was not judged. */
    @Field(() => KnowledgeSourceNatureType, { nullable: true })
    nature?: KnowledgeSourceNatureType | null
}
