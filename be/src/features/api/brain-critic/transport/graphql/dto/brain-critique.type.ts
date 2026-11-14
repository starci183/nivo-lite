import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One quoted place of a point, verbatim, with the page / slide / sheet of its passage when the reader gave one. */
export class BrainCritiqueQuoteType {
    /** The words. */
    @Field(() => String)
    text!: string

    /** page, slide or sheet; null when the file names none. */
    @Field(() => String, { nullable: true })
    placeKind!: string | null

    /** The page or slide number, or the sheet name. */
    @Field(() => String, { nullable: true })
    placeLabel!: string | null

    /** The model-free hash of the passage. */
    @Field(() => String, { nullable: true })
    chunkHash!: string | null

    /** The stored passage. */
    @Field(() => ID, { nullable: true })
    passageId!: string | null

    /** The document it comes from. */
    @Field(() => String, { nullable: true })
    sourceTitle!: string | null

    /** `this` (a passage of this document) or `other` (another document, the value in use). */
    @Field(() => String)
    role!: string
}

@ObjectType()
/** What a point is compared with. */
export class BrainCritiqueAgainstType {
    /** truth (in force), proposal (waiting) or document. */
    @Field(() => String)
    kind!: string

    /** Its value. */
    @Field(() => String)
    value!: string

    /** The document it comes from. */
    @Field(() => String, { nullable: true })
    sourceTitle!: string | null

    /** The fact. */
    @Field(() => ID, { nullable: true })
    factId!: string | null
}

@ObjectType()
/** An answer, offered or given: pick, value, keep_document, keep_shop, split or remove. */
export class BrainCritiqueAnswerType {
    /** What it does. */
    @Field(() => String)
    kind!: string

    /** The fact it is about. */
    @Field(() => ID, { nullable: true })
    factId!: string | null

    /** The value it names. */
    @Field(() => String, { nullable: true })
    value!: string | null

    /** The condition of a split. */
    @Field(() => String, { nullable: true })
    situation?: string | null
}

@ObjectType()
/** One of the (at most two) buttons of a point. */
export class BrainCritiqueChoiceType {
    /** "a" or "b". */
    @Field(() => String)
    id!: string

    /** The words on the button. */
    @Field(() => String)
    label!: string

    /** True when the button opens an input. */
    @Field(() => Boolean)
    needsInput!: boolean

    /** The placeholder of that input. */
    @Field(() => String, { nullable: true })
    inputHint!: string | null

    /** What choosing it does. */
    @Field(() => BrainCritiqueAnswerType)
    answer!: BrainCritiqueAnswerType
}

@ObjectType()
/** One point of the critique: a question to the founder, never a change. */
export class BrainCritiquePointType {
    /** The point id. */
    @Field(() => ID)
    id!: string

    /** inside, shop, typo, other_document, unclear or stale (the chip). */
    @Field(() => String)
    group!: string

    /** The critic kind. */
    @Field(() => String)
    kind!: string

    /** high, medium or low; an open high point holds its passages back from customers. */
    @Field(() => String)
    severity!: string

    /** rule or ai. */
    @Field(() => String)
    origin!: string

    /** The line the founder reads. */
    @Field(() => String)
    line!: string

    /** Why NIVO doubts it. */
    @Field(() => String)
    why!: string

    /** The question to the founder. */
    @Field(() => String)
    question!: string

    /** The quoted places. */
    @Field(() => [BrainCritiqueQuoteType])
    quotes!: ReadonlyArray<BrainCritiqueQuoteType>

    /** What it is compared with. */
    @Field(() => BrainCritiqueAgainstType, { nullable: true })
    against!: BrainCritiqueAgainstType | null

    /** At most two buttons. */
    @Field(() => [BrainCritiqueChoiceType])
    choices!: ReadonlyArray<BrainCritiqueChoiceType>

    /** open, answered, skipped or gone. */
    @Field(() => String)
    state!: string

    /** The answer given. */
    @Field(() => BrainCritiqueAnswerType, { nullable: true })
    answer!: BrainCritiqueAnswerType | null

    /** The waiting proposal it became. */
    @Field(() => ID, { nullable: true })
    proposalFactId!: string | null

    /** When it was decided, ISO 8601. */
    @Field(() => String, { nullable: true })
    decidedAt!: string | null

    /** When it was first raised. */
    @Field(() => String)
    firstSeenAt!: string
}

@ObjectType()
/** Where the critique of a document stands. */
export class BrainCritiqueReviewType {
    /** waiting, running, done or not_done. */
    @Field(() => String)
    state!: string

    /** Why it is not done: model, credits, facts_unread or budget. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** Tries of the model in the last critique. */
    @Field(() => Int)
    attempts!: number

    /** When it last ended. */
    @Field(() => String, { nullable: true })
    finishedAt!: string | null

    /** True when the founder let customers read this version without a finished critique. */
    @Field(() => Boolean)
    released!: boolean

    /** When. */
    @Field(() => String, { nullable: true })
    releasedAt!: string | null

    /** Passages no finished critique has reviewed yet: withheld from customers for that reason until one does (0 = all reviewed). */
    @Field(() => Int, { defaultValue: 0 })
    waitingPassages!: number
}

@ObjectType()
/** What customer-facing agents may read of a document. */
export class BrainCritiqueServingType {
    /** withheld, partly or served. */
    @Field(() => String)
    state!: string

    /** Passages customers may not read yet. */
    @Field(() => Int)
    withheldPassages!: number

    /** All passages. */
    @Field(() => Int)
    totalPassages!: number

    /** Of the withheld: passages an open high or medium point quotes; only an answer or a skip frees them, a release does not. */
    @Field(() => Int, { defaultValue: 0 })
    heldPassages!: number

    /** Of the withheld: passages no finished critique has read and the founder has not released. */
    @Field(() => Int, { defaultValue: 0 })
    unreviewedPassages!: number

    /** Why passages are withheld, as codes: `open_points`, `unreviewed`; empty when everything is served. */
    @Field(() => [String], { defaultValue: [] })
    reasons!: ReadonlyArray<string>
}

@ObjectType()
/** The points of a document by state. */
export class BrainCritiqueCountsType {
    /** Still to see (the "N points to see" badge). */
    @Field(() => Int)
    open!: number

    /** Open and high. */
    @Field(() => Int)
    high!: number

    /** Answered. */
    @Field(() => Int)
    answered!: number

    /** Skipped. */
    @Field(() => Int)
    skipped!: number

    /** No longer in the document. */
    @Field(() => Int)
    gone!: number
}

@ObjectType()
/** The critique of one shop document (the "document check" card). */
export class BrainCritiqueType {
    /** The document. */
    @Field(() => ID)
    sourceId!: string

    /** Its title. */
    @Field(() => String)
    title!: string

    /** Where the critique stands. */
    @Field(() => BrainCritiqueReviewType)
    review!: BrainCritiqueReviewType

    /** What customers may read. */
    @Field(() => BrainCritiqueServingType)
    serving!: BrainCritiqueServingType

    /** Counts. */
    @Field(() => BrainCritiqueCountsType)
    counts!: BrainCritiqueCountsType

    /** The points in the states asked for. */
    @Field(() => [BrainCritiquePointType])
    points!: ReadonlyArray<BrainCritiquePointType>
}

@ObjectType()
/** One critiqued document in the list. */
export class BrainCritiqueSourceType {
    /** The document. */
    @Field(() => ID)
    sourceId!: string

    /** Its title. */
    @Field(() => String)
    title!: string

    /** Where its critique stands. */
    @Field(() => BrainCritiqueReviewType)
    review!: BrainCritiqueReviewType

    /** Open points. */
    @Field(() => Int)
    open!: number

    /** Open high points. */
    @Field(() => Int)
    high!: number
}
