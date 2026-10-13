import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The non-enumerating result of asking for a loyalty code. */
export class RequestLoyaltyCodeType {
    /** The outcome code for visitor copy. */
    @Field()
    code!: string
}
