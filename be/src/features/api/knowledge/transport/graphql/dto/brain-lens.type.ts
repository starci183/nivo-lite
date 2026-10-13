import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One agent the owner can look through. */
export class BrainLensType {
    /** The module of the agent. */
    @Field(() => String)
    module!: string

    /** The display name. */
    @Field(() => String)
    name!: string

    /** `customer` or `internal`. */
    @Field(() => String)
    audience!: string
}
