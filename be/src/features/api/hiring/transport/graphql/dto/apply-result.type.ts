import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What applying for a job answers. */
export class ApplyResultType {
    /** Whether the applicant had already applied for this job. */
    @Field(() => Boolean)
    duplicate!: boolean
}
