import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The header facts of one workspace. */
export class AdminWorkspaceHeaderType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field()
    name!: string

    /** The owner email. */
    @Field(() => String, { nullable: true })
    ownerEmail!: string | null

    /** The status. */
    @Field()
    status!: string

    /** The plan code. */
    @Field(() => String, { nullable: true })
    planCode!: string | null

    /** The paid until. */
    @Field(() => String, { nullable: true })
    paidUntil!: string | null

    /** The created at. */
    @Field()
    createdAt!: string
}
