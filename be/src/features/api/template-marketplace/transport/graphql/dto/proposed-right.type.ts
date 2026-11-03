import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A data right the creator proposes and the buyer turns on. */
export class ProposedRightType {
    /** The kind of data. */
    @Field(() => String)
    kind!: string

    /** `conversation` or `workspace`. */
    @Field(() => String)
    scope!: string
}
