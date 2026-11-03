import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { ListingCheckType } from "./listing-check.type"
import { TemplateTextType } from "./template-text.type"

@ObjectType()
/** One listing as the creator and the reviewer read it. */
export class ListingType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The template key. */
    @Field(() => String)
    templateKey!: string

    /** The version. */
    @Field(() => Int)
    version!: number

    /** `draft`, `submitted`, `approved` or `rejected`. */
    @Field(() => String)
    status!: string

    /** The price in VND; zero is free. */
    @Field(() => Int)
    priceVnd!: number

    /** The percent that is the creator. */
    @Field(() => Int)
    revenueSharePct!: number

    /** The automated checks of the last submit. */
    @Field(() => [ListingCheckType])
    checks!: Array<ListingCheckType>

    /** What the reviewer wrote. */
    @Field(() => String)
    reviewNote!: string

    /** True for a listing of the platform itself. */
    @Field(() => Boolean)
    firstParty!: boolean

    /** The name on the card. */
    @Field(() => TemplateTextType)
    name!: TemplateTextType

    /** When it was last changed, ISO 8601. */
    @Field(() => String)
    updatedAt!: string
}
