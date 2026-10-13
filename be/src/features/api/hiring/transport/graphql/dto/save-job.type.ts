import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What saving a job post answers. */
export class SaveJobType {
    /** The job id. */
    @Field(() => ID)
    id!: string

    /** The slug in the public link. */
    @Field(() => String)
    slug!: string
}
