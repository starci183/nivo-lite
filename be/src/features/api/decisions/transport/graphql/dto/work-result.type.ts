import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a performer reported it did. */
export class WorkResultType {
    /** One sentence for the log. */
    @Field()
    summary!: string

    /** Where the owner can see it. */
    @Field(() => String, { nullable: true })
    href?: string | null
}
