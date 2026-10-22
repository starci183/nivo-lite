import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A tag as a thread shows it: who, with the name of its chip. */
export class ThreadMentionType {
    /** member, agent or group. */
    @Field()
    kind!: string

    /** The member's Auth user id, the agent id or the group id. */
    @Field()
    id!: string

    /** The name on the chip. */
    @Field()
    name!: string
}
