import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The position to pass as `before` for the next older page. */
export class OfficeThreadCursorType {
    /** The `created_at` of the oldest message of this page. */
    @Field()
    createdAt!: string

    /** The id of the oldest message of this page. */
    @Field(() => ID)
    id!: string
}
