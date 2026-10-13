import { Field, ObjectType, ID } from "@nestjs/graphql"
import { LoyaltyConfigType } from "./loyalty-config.type"

@ObjectType()
/** The loyalty program fields exposed through GraphQL. */
export class LoyaltyProgramType {
    /** The workspace id. */
    @Field(() => ID)
    workspaceId!: string

    /** The slug. */
    @Field(() => String)
    slug!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The enabled. */
    @Field(() => Boolean)
    enabled!: boolean

    /** The config. */
    @Field(() => LoyaltyConfigType)
    config!: LoyaltyConfigType

    /** The created at. */
    @Field(() => String)
    createdAt!: string
}
