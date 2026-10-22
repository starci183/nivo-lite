import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What one member may approve for one action. */
export class MemberGrantType {
    /** The member. */
    @Field(() => ID)
    memberId!: string

    /** The action key. */
    @Field()
    action!: string

    /** What the limit is counted in: `vnd`, `percent` or `count`. */
    @Field()
    unit!: string

    /** The largest amount the member may approve (inclusive); null means no limit. */
    @Field(() => Float, { nullable: true })
    maxAmount!: number | null
}
