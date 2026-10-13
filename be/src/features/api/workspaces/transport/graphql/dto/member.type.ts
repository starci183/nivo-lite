import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One member of a workspace. */
export class MemberType {
    /** The Auth user. */
    @Field(() => ID)
    userId!: string

    /** The workspace the membership belongs to. */
    @Field(() => ID)
    workspaceId!: string

    /** `owner`, `manager` or `staff`. */
    @Field()
    role!: string

    /** The staff row this account is, when it is one. */
    @Field(() => ID, { nullable: true })
    staffId!: string | null

    /** The name Office and the decision history show. */
    @Field()
    displayName!: string

    /** `active` or `disabled`. */
    @Field()
    status!: string
}
