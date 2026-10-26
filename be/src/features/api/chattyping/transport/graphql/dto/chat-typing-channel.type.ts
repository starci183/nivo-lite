import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The exact protocol for an authorized private Supabase typing subscription. */
export class ChatTypingChannelType {
    /** Pass this exact string to supabase.channel. */
    @Field()
    topic!: string

    /** Listen for this broadcast event. */
    @Field()
    event!: string

    /** Always true; use config.private = true when joining. */
    @Field()
    private!: boolean

    /** Refresh a typing hint before this interval ends. */
    @Field(() => Int)
    ttlMs!: number
}
