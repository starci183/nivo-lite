import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The shop an automation speaks for. */
export class ShopContextType {
    /** The name of the shop. */
    @Field()
    shop!: string

    /** The opening hours as `HH:MM - HH:MM`, or empty. */
    @Field()
    hours!: string

    /** The tone of voice the owner set. */
    @Field()
    tone!: string
}
