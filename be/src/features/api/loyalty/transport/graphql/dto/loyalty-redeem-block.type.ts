import { Field, ObjectType } from "@nestjs/graphql"
import { LoyaltyBlockParameterType } from "./loyalty-block-parameter.type"

@ObjectType()
/** The loyalty redeem block fields exposed through GraphQL. */
export class LoyaltyRedeemBlockType {
    /** The code. */
    @Field(() => String)
    code!: string

    /** The params. */
    @Field(() => [LoyaltyBlockParameterType])
    params!: ReadonlyArray<LoyaltyBlockParameterType>
}
