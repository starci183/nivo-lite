import { Field, ObjectType } from "@nestjs/graphql"
import { PublicLoyaltyPointsType } from "./public-loyalty-points.type"

@ObjectType()
/** The loyalty points check after code verification. */
export class VerifyLoyaltyCodeType {
    /** The outcome code for visitor copy. */
    @Field()
    code!: string

    /** The points view unlocked by the accepted code. */
    @Field(() => PublicLoyaltyPointsType)
    points!: PublicLoyaltyPointsType
}
