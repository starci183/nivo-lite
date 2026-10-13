import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The loyalty block parameter fields exposed through GraphQL. */
export class LoyaltyBlockParameterType {
    /** The key. */
    @Field(() => String)
    key!: string

    /** The value. */
    @Field(() => String)
    value!: string
}
