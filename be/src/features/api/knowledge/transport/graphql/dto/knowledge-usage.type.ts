import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The documents of ONE upload area (public or internal) against the area's own limit. */
export class KnowledgeAreaUsageType {
    /** The raw bytes the area's documents hold now. */
    @Field(() => Int)
    usedBytes!: number

    /** The area's limit in bytes (read it; never print a fixed number). An upload or a move past it is refused `KNOWLEDGE_SOURCES_PUBLIC_AREA_FULL` / `KNOWLEDGE_SOURCES_INTERNAL_AREA_FULL`. */
    @Field(() => Int)
    limitBytes!: number

    /** What the area has left, never negative. */
    @Field(() => Int)
    leftBytes!: number

    /** How many documents the area holds (a long file cut into parts counts once). */
    @Field(() => Int)
    count!: number
}

@ObjectType()
/** The two upload areas of the Second Brain. */
export class KnowledgeAreasUsageType {
    /** Public documents: customers' agents read them. */
    @Field(() => KnowledgeAreaUsageType)
    public!: KnowledgeAreaUsageType

    /** Internal documents: only the team and internal agents read them. */
    @Field(() => KnowledgeAreaUsageType)
    internal!: KnowledgeAreaUsageType
}

@ObjectType()
/** The Second Brain documents of a workspace against their own limit of source bytes, the same for every workspace whatever its plan. */
export class KnowledgeDocumentsUsageType {
    /** The raw bytes all its documents hold now. */
    @Field(() => Int)
    usedBytes!: number

    /** The limit in bytes, the same for every workspace (read it; never print a fixed number). An upload past it is refused `KNOWLEDGE_SOURCES_QUOTA_EXCEEDED`; the plan's storage is a separate check. */
    @Field(() => Int)
    limitBytes!: number

    /** How many documents it holds (a long file cut into parts counts once). */
    @Field(() => Int)
    count!: number

    /** The same per upload area: each area has its own limit (two areas are the whole limit). */
    @Field(() => KnowledgeAreasUsageType)
    areas!: KnowledgeAreasUsageType
}

@ObjectType()
/** The truths in force of a workspace against the ceiling of truths (5,000 truths, 2 MB of text; unchanged). */
export class KnowledgeTruthsUsageType {
    /** Truths in force (active and scheduled). */
    @Field(() => Int)
    count!: number

    /** The most truths in force. */
    @Field(() => Int)
    limitCount!: number

    /** The bytes of their text. */
    @Field(() => Int)
    usedBytes!: number

    /** The most truth text in force, in bytes. */
    @Field(() => Int)
    limitBytes!: number
}

@ObjectType()
/** How much of its raw document allowance a workspace has used. */
export class KnowledgeUsageType {
    /** The raw bytes its documents hold now. */
    @Field(() => Int)
    usedBytes!: number

    /**
     * The most raw bytes it may hold, capped at 2,147,483,647: a plan's storage is gigabytes and does not fit a 32-bit integer. Read
     * `limitMb` for the real allowance.
     */
    @Field(() => Int)
    limitBytes!: number

    /** The megabytes its documents hold now, one decimal. */
    @Field(() => Float)
    usedMb!: number

    /** The megabytes of Second Brain documents it may hold, the same for every workspace (not the plan's storage). */
    @Field(() => Float)
    limitMb!: number

    /** The truths in force of the business (active and scheduled). */
    @Field(() => Int)
    truthsInForce!: number

    /** The ceiling of truths in force: past it a document's truths wait as proposals. */
    @Field(() => Int)
    truthsCeiling!: number

    /** The bytes of truth text in force. */
    @Field(() => Int)
    truthBytes!: number

    /** The ceiling of truth text in force, in bytes. */
    @Field(() => Int)
    truthBytesCeiling!: number

    /** The documents tab's first gauge: Second Brain documents against their limit. */
    @Field(() => KnowledgeDocumentsUsageType)
    documents!: KnowledgeDocumentsUsageType

    /** The documents tab's second gauge: truths in force against their ceiling. */
    @Field(() => KnowledgeTruthsUsageType)
    truths!: KnowledgeTruthsUsageType
}
