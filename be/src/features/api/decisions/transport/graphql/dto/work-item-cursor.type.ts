import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The position after which the next page of work items starts. */
export class WorkItemCursorType {
    /** The `created_at` of the last item of the page. */
    @Field()
    createdAt!: string

    /** The id of the last item of the page. */
    @Field(() => ID)
    id!: string
}
