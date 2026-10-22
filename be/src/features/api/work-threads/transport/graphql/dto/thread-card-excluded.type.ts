import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One person left out of an approval card and why. */
export class ThreadCardExcludedType {
    /** The member's Auth user id. */
    @Field()
    memberId!: string

    /** The display name. */
    @Field()
    name!: string

    /** Why the person was left out. */
    @Field()
    reason!: string
}
