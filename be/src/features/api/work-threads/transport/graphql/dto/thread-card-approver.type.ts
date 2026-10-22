import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One person tagged on an approval card and what they did. */
export class ThreadCardApproverType {
    /** The member's Auth user id. */
    @Field()
    memberId!: string

    /** The display name. */
    @Field()
    name!: string

    /** owner, manager or staff. */
    @Field()
    role!: string

    /** The key of the room the member sits in. */
    @Field(() => String, { nullable: true })
    roomId!: string | null

    /** waiting, approved or rejected. */
    @Field()
    status!: string
}
