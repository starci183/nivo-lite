import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The shop and program names on a public points page. */
export class PublicLoyaltyPageType {
    /** The public program slug. */
    @Field()
    slug!: string

    /** The shop name. */
    @Field()
    shop!: string

    /** The program name. */
    @Field()
    name!: string
}
