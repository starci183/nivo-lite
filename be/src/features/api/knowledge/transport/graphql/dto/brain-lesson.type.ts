import { Field, ID, ObjectType } from "@nestjs/graphql"
import { BrainEvidenceType } from "./brain-evidence.type"

@ObjectType()
/** How an agent should work, learnt from the owner. */
export class BrainLessonType {
    /** The lesson id. */
    @Field(() => ID)
    id!: string

    /** The agent it is for; null = every agent. */
    @Field(() => String, { nullable: true })
    module?: string | null

    /** The short title. */
    @Field(() => String)
    title!: string

    /** What to do. */
    @Field(() => String)
    body!: string

    /** When it applies. */
    @Field(() => String)
    appliesWhen!: string

    /** `proposed`, `active`, `retired` or `rejected`. */
    @Field(() => String)
    status!: string

    /** What it was learnt from. */
    @Field(() => [BrainEvidenceType])
    evidence!: Array<BrainEvidenceType>
}
