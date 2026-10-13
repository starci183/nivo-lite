import { Field, ObjectType, Float, Int } from "@nestjs/graphql"
import { LoyaltyCategoryType } from "./loyalty-category.type"

@ObjectType()
/** The loyalty earn fields exposed through GraphQL. */
export class LoyaltyEarnType {
    /** The per thousand vnd. */
    @Field(() => Float)
    perThousandVnd!: number

    /** The per visit. */
    @Field(() => Int)
    perVisit!: number

    /** The categories. */
    @Field(() => [LoyaltyCategoryType])
    categories!: ReadonlyArray<LoyaltyCategoryType>

    /** The trigger. */
    @Field(() => String)
    trigger!: string

    /** The min order vnd. */
    @Field(() => Float)
    minOrderVnd!: number
}
