import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What producing a change request cost in AI, exact: credits are a fraction, never rounded per call. */
export class ChatBrainChangeCostType {
    /** The credits, an exact fraction ("Credit"). */
    @Field(() => Float)
    credits!: number

    /** The exact cost in USD. */
    @Field(() => Float)
    usd!: number
}

@ObjectType()
/** The truth a change card is about, as people write it. */
export class ChatBrainChangeFactKeyType {
    /** The subject ("Giao hang"). */
    @Field(() => String)
    subjectLabel!: string

    /** The attribute ("Phi ship noi thanh"). */
    @Field(() => String)
    attributeLabel!: string
}

@ObjectType()
/** The value in force the proposal would replace. */
export class ChatBrainChangeCurrentType {
    /** The value in force. */
    @Field(() => String)
    value!: string

    /** Its version; null on a row the version backfill did not reach. */
    @Field(() => Int, { nullable: true })
    version!: number | null

    /** Where it came from, for people (a document title, "chat", a person's name). */
    @Field(() => String)
    source!: string
}

@ObjectType()
/** Who said or wrote the words of a piece of evidence. */
export class ChatBrainChangeByType {
    /** The name people read. */
    @Field(() => String)
    name!: string

    /** The account of the member who said it; null for a document or someone outside the workspace. */
    @Field(() => ID, { nullable: true })
    memberId!: string | null
}

@ObjectType()
/** One piece of evidence a change rests on, verbatim. */
export class ChatBrainChangeEvidenceType {
    /** What it is: message | answer | document. */
    @Field(() => String)
    kind!: string

    /** The words, verbatim. */
    @Field(() => String)
    quote!: string

    /** Where it lives. */
    @Field(() => String)
    ref!: string

    /** Who said or wrote it. */
    @Field(() => ChatBrainChangeByType)
    by!: ChatBrainChangeByType

    /** When, ISO; null when unknown. */
    @Field(() => String, { nullable: true })
    at!: string | null
}

@ObjectType()
/** Who decided a change card and when. */
export class ChatBrainChangeDecidedType {
    /** The account of the member who decided. */
    @Field(() => ID)
    memberId!: string

    /** Their display name when they decided. */
    @Field(() => String)
    name!: string

    /** When, ISO. */
    @Field(() => String)
    at!: string
}

@ObjectType()
/** A truth-graph change card (`brain.change`) as the viewer sees it: old to new, the reason, the evidence, and what the viewer may do. */
export class ChatBrainChangeCardType {
    /** The change request (the proposed fact of the truth graph). */
    @Field(() => ID)
    changeId!: string

    /** Where it came from: chat | learning | document. */
    @Field(() => String)
    origin!: string

    /** What it does: change | add | retire. */
    @Field(() => String)
    kind!: string

    /** The truth. */
    @Field(() => ChatBrainChangeFactKeyType)
    factKey!: ChatBrainChangeFactKeyType

    /** The value in force (= current.value), or null for a new truth. */
    @Field(() => String, { nullable: true })
    oldValue!: string | null

    /** The value in force with its version and source; null for a new truth. */
    @Field(() => ChatBrainChangeCurrentType, { nullable: true })
    current!: ChatBrainChangeCurrentType | null

    /** The proposed value; empty for retire. */
    @Field(() => String)
    newValue!: string

    /** The unit, when written apart from the value. */
    @Field(() => String, { nullable: true })
    unit!: string | null

    /** From when the new value holds, when said. */
    @Field(() => String, { nullable: true })
    validFrom!: string | null

    /** Until when it holds, when said. */
    @Field(() => String, { nullable: true })
    validTo!: string | null

    /** Why the truth changes, in the agent's own plain words. */
    @Field(() => String)
    reason!: string

    /** The words it rests on, oldest first. */
    @Field(() => [ChatBrainChangeEvidenceType])
    evidence!: ReadonlyArray<ChatBrainChangeEvidenceType>

    /** Where it stands: open | applied | rejected | superseded. */
    @Field(() => String)
    state!: string

    /** Who decided and when; null while open or superseded. */
    @Field(() => ChatBrainChangeDecidedType, { nullable: true })
    decidedBy!: ChatBrainChangeDecidedType | null

    /** The newer change request that superseded this one; null otherwise. */
    @Field(() => ID, { nullable: true })
    supersededBy!: string | null

    /** How many times the card was written (compare it to redraw). */
    @Field(() => Int)
    revision!: number

    /** Whether this viewer is offered Approve: the workspace owner while open. */
    @Field(() => Boolean)
    canApprove!: boolean

    /** Whether this viewer is offered Refuse: the owner or a manager while open. */
    @Field(() => Boolean)
    canReject!: boolean

    /** What producing this proposal cost in AI (a learning card: the judgements and the draft); null for staff or when not known. */
    @Field(() => ChatBrainChangeCostType, { nullable: true })
    cost!: ChatBrainChangeCostType | null
}
