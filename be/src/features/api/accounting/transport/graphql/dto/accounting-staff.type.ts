import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Accounting Staff returned by GraphQL. */
export class AccountingStaffType {
    /** id. */
    @Field(() => String)
    id!: string

    /** workspace Id. */
    @Field(() => String)
    workspaceId!: string

    /** name. */
    @Field(() => String)
    name!: string

    /** role. */
    @Field(() => String)
    role!: string

    /** email. */
    @Field(() => String, { nullable: true })
    email!: string | null

    /** active. */
    @Field(() => Boolean)
    active!: boolean

    /** created At. */
    @Field(() => String)
    createdAt!: string
}
