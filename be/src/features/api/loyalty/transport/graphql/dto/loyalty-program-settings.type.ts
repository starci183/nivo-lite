import { Field, ObjectType } from "@nestjs/graphql"
import { LoyaltyProgramType } from "./loyalty-program.type"
import { LoyaltyConfigType } from "./loyalty-config.type"
import { LoyaltyRewardType } from "./loyalty-reward.type"

@ObjectType()
/** The loyalty program settings fields exposed through GraphQL. */
export class LoyaltyProgramSettingsType {
    /** The program. */
    @Field(() => LoyaltyProgramType, { nullable: true })
    program!: LoyaltyProgramType | null

    /** The config. */
    @Field(() => LoyaltyConfigType)
    config!: LoyaltyConfigType

    /** The rewards. */
    @Field(() => [LoyaltyRewardType])
    rewards!: ReadonlyArray<LoyaltyRewardType>
}
