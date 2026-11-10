import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** How far the reading of one source document got. */
export class BrainGraphReadingType {
    /** `queued`, `running`, `done`, `failed` or `blocked_credits`. */
    @Field(() => String)
    status!: string

    /** Windows read. */
    @Field(() => Int)
    windowsDone!: number

    /** Windows of this reading (only the changed passages on a re-read). */
    @Field(() => Int)
    windowsTotal!: number

    /** Facts filed by the reading. */
    @Field(() => Int)
    factsProposed!: number
}
