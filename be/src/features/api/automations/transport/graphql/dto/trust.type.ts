import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The trust ladder of one pipeline. */
export class TrustType {
    /** Consecutive owner approvals without edits. */
    @Field(() => Int)
    streak!: number

    /** True when send by itself is on offer. */
    @Field(() => Boolean)
    offered!: boolean

    /** True when the owner accepted it. */
    @Field(() => Boolean)
    autoSend!: boolean
}
