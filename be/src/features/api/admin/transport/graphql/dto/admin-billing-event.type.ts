import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One billing event of a workspace. */
export class AdminBillingEventType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The kind. */
    @Field()
    kind!: string

    /** The created at. */
    @Field()
    createdAt!: string
}
