import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A guide question whose answer was queued: poll it with `agentGenerationStatus`. */
export class GuideAskedType {
    /** The queued text. */
    @Field(() => ID)
    generationId!: string

    /** The initial state, `queued`. */
    @Field()
    status!: string
}
