import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A tag target: who is tagged. */
export class ThreadMentionRefType {
    /** member, agent or group. */
    @Field()
    kind!: string

    /** The member's Auth user id, the agent id or the group id. */
    @Field()
    id!: string
}
