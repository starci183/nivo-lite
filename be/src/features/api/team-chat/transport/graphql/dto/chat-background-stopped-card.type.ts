import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where the founder retries a stopped background work: a place of the web, by key. */
export class ChatBackgroundStoppedTargetType {
    /** The place, by key: `brain.policies` (the Policies tab of the Second Brain page). */
    @Field(() => String)
    kind!: string
}

@ObjectType()
/** NIVO's "background work stopped" card (`background.stopped`): codes only, the web words them. */
export class ChatBackgroundStoppedCardType {
    /** What stopped, by key: `brain.policies.derive`. */
    @Field(() => String)
    work!: string

    /** Why it stopped: `model` (the AI gave nothing usable), `credits` (no credits left) or `gave_up` (the retries ran out). */
    @Field(() => String)
    reason!: string

    /** When it stopped, ISO. */
    @Field(() => String)
    since!: string

    /** The failure episode the card is about, ISO (for the derive pass: when the failed pass was asked for). */
    @Field(() => String)
    episode!: string

    /** Where the founder retries it. */
    @Field(() => ChatBackgroundStoppedTargetType)
    target!: ChatBackgroundStoppedTargetType
}
