import { Field, ObjectType, Int } from "@nestjs/graphql"
import { LoyaltySampleMemberType } from "./loyalty-sample-member.type"

@ObjectType()
/** The preview loyalty segment fields exposed through GraphQL. */
export class PreviewLoyaltySegmentType {
    /** The total. */
    @Field(() => Int)
    total!: number

    /** The reachable. */
    @Field(() => Int)
    reachable!: number

    /** The sample. */
    @Field(() => [LoyaltySampleMemberType])
    sample!: ReadonlyArray<LoyaltySampleMemberType>
}
