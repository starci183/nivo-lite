import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where the reading of one document stands. */
export class BrainExtractionType {
    /** The document. */
    @Field(() => ID)
    sourceId!: string

    /** `queued`, `running`, `done`, `failed` or `blocked_credits`. */
    @Field(() => String)
    status!: string
}
