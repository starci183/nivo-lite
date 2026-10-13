import { Field, ObjectType } from "@nestjs/graphql"
import { SetupFactType } from "./setup-fact.type"

@ObjectType()
/** The draft of a setup: the summary of the business and the facts learned. */
export class SetupDraftType {
    /** One to three sentences about the business. */
    @Field()
    summary!: string

    /** The facts learned. */
    @Field(() => [SetupFactType])
    facts!: ReadonlyArray<SetupFactType>
}
