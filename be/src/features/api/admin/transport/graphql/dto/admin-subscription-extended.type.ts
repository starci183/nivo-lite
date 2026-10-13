import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What extending a subscription answers. */
export class AdminSubscriptionExtendedType {
    /** The paid until. */
    @Field()
    paidUntil!: string
}
