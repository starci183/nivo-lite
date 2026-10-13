import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One knowledge suggestion a workspace decided about. */
export class SuggestionDecisionType {
    /** The key of the suggestion. */
    @Field(() => String)
    key!: string

    /** `dismissed` or `not_applicable`. */
    @Field(() => String)
    state!: string
}
