import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One agent a connection can be attached to. */
export class ConnectionAgentType {
    /** The agent id. */
    @Field(() => ID)
    id!: string

    /** The display name. */
    @Field(() => String)
    name!: string

    /** The module key. */
    @Field(() => String)
    module!: string

    /** `active` or `paused`. */
    @Field(() => String)
    status!: string
}
