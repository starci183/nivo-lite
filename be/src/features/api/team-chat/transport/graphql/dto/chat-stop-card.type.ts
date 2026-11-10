import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import {
    ChatStopAuthor,
    ChatStopDecision,
    ChatStopHandler,
    ChatStopKind,
    ChatStopReplyKind,
    ChatStopState,
    ChatStopVerdict,
} from "./chat-stop-enums.type"

@ObjectType()
/** What the engine needs to go on: the founder's words, a button, a verdict. Nothing anywhere: the stop asks nothing now. */
export class ChatStopNeedsType {
    /** Whether a free-text answer (a reply to the card, or its box) moves the run. */
    @Field(() => Boolean)
    answer!: boolean

    /** The buttons the engine accepts now. */
    @Field(() => [ChatStopDecision])
    decisions!: ReadonlyArray<string>

    /** The verdicts the engine accepts now (a permission request only). */
    @Field(() => [ChatStopVerdict])
    verdicts!: ReadonlyArray<string>
}

@ObjectType()
/** One reply the stop received: the trace the card keeps. */
export class ChatStopReplyType {
    /** What the reply was. */
    @Field(() => ChatStopReplyKind)
    kind!: string

    /** The founder's words; null for a button, a verdict or a deadline. */
    @Field(() => String, { nullable: true })
    text!: string | null

    /** Who replied, as the stop keeps it (a member seat), or `deadline`. */
    @Field(() => String)
    by!: string

    /** The name of who replied; empty for a deadline or a member that left. */
    @Field(() => String)
    byName!: string

    /** When, ISO. */
    @Field(() => String)
    at!: string
}

@ObjectType()
/** One true fact the engine attached to a stop. */
export class ChatStopFactType {
    /** The name of the fact. */
    @Field(() => String)
    name!: string

    /** Its value. */
    @Field(() => String)
    value!: string

    /**
     * True for a raw value (an error code, an id, the raw words of an error): fold it under "Chi tiet ky thuat", never show it as the
     * content. False for a worded fact; null for an argument of a permission request.
     */
    @Field(() => Boolean, { nullable: true })
    technical?: boolean | null
}

@ObjectType()
/** One way on the AI suggests, and who would carry it. */
export class ChatStopSuggestionType {
    /** The words, sent as the founder's reply when tapped. */
    @Field(() => String)
    text!: string

    /** Who carries it. */
    @Field(() => ChatStopHandler)
    handledBy!: string
}

@ObjectType()
/** What a permission request asks to do. Approve / refuse go through the work item's decision (`workItemId`), not `decideRunStop`. */
export class ChatStopApprovalType {
    /** The owner's work item the verdict goes through. */
    @Field(() => ID)
    workItemId!: string

    /** The tool the agent wants to use. */
    @Field(() => String)
    tool!: string

    /** The connected account the call would use. */
    @Field(() => String)
    account!: string

    /** The ability set to ask. */
    @Field(() => String)
    ability!: string

    /** The call's arguments, by name. */
    @Field(() => [ChatStopFactType])
    args!: ReadonlyArray<ChatStopFactType>
}

@ObjectType()
/** The stop a `workflow.stopped` card is about: one card per stop, rewritten in place when its state changes. */
export class ChatStopCardType {
    /** The stop record; null on a card the old engine posted. */
    @Field(() => ID, { nullable: true })
    stopId!: string | null

    /** The run. */
    @Field(() => ID)
    runId!: string

    /** The step that stopped. */
    @Field(() => String)
    stepKey!: string

    /** The step in the team's words. */
    @Field(() => String)
    stepTitle!: string

    /** The workflow in the team's words. */
    @Field(() => String)
    workflowTitle!: string

    /** The module of the workflow. */
    @Field(() => String)
    moduleKey!: string

    /** The customer, when the run names one. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The conversation, when the run has one. */
    @Field(() => ID, { nullable: true })
    conversationId!: string | null

    /** Which stop it is. */
    @Field(() => ChatStopKind)
    kind!: string

    /** Who worded the reason. */
    @Field(() => ChatStopAuthor)
    by!: string

    /** Where it stands. */
    @Field(() => ChatStopState)
    state!: string

    /** The short common heading, in the team's language. */
    @Field(() => String)
    headline!: string

    /** The reason, in the AI's words or NIVO's. */
    @Field(() => String)
    message!: string

    /** The question for the founder, or null. */
    @Field(() => String, { nullable: true })
    question!: string | null

    /** The AI's suggested ways on; none once the stop is not open. */
    @Field(() => [ChatStopSuggestionType])
    suggestions!: ReadonlyArray<ChatStopSuggestionType>

    /** The engine's true facts. */
    @Field(() => [ChatStopFactType])
    facts!: ReadonlyArray<ChatStopFactType>

    /** What the engine needs to go on. */
    @Field(() => ChatStopNeedsType)
    needs!: ChatStopNeedsType

    /** The founder's replies, oldest first. */
    @Field(() => [ChatStopReplyType])
    replies!: ReadonlyArray<ChatStopReplyType>

    /** How many times the step stopped. */
    @Field(() => Int)
    repeats!: number

    /** When it first stopped, ISO. */
    @Field(() => String)
    firstAt!: string

    /** When it last stopped, ISO. */
    @Field(() => String)
    stoppedAt!: string

    /** When it resolved, ISO; null while it is open or the step runs again. */
    @Field(() => String, { nullable: true })
    resolvedAt!: string | null

    /** What a permission request asks to do; null for any other stop. */
    @Field(() => ChatStopApprovalType, { nullable: true })
    approval!: ChatStopApprovalType | null

    /** How many times the card was written; it grows on every rewrite (0 on an old-engine card). */
    @Field(() => Int)
    revision!: number
}
