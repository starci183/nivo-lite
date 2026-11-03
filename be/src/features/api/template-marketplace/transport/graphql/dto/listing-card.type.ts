import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { TemplateParameterType } from "./template-parameter.type"
import { TemplateTextType } from "./template-text.type"

@ObjectType()
/** A listing of the catalogue, as the buyer reads it. */
export class ListingCardType {
    /** The listing. */
    @Field(() => ID)
    id!: string

    /** The template key. */
    @Field(() => String)
    templateKey!: string

    /** The version. */
    @Field(() => Int)
    version!: number

    /** The name. */
    @Field(() => TemplateTextType)
    name!: TemplateTextType

    /** The summary. */
    @Field(() => TemplateTextType)
    summary!: TemplateTextType

    /** The selling points. */
    @Field(() => [TemplateTextType])
    points!: Array<TemplateTextType>

    /** The category key. */
    @Field(() => String)
    category!: string

    /** Who made it. */
    @Field(() => String)
    publisherName!: string

    /** True for a listing of the platform itself. */
    @Field(() => Boolean)
    firstParty!: boolean

    /** The price in VND; zero is free. */
    @Field(() => Int)
    priceVnd!: number

    /** The settings the buyer fills in. */
    @Field(() => [TemplateParameterType])
    parameters!: Array<TemplateParameterType>

    /** The providers to connect. */
    @Field(() => [String])
    requiredProviders!: Array<string>

    /** The actions that need a rule. */
    @Field(() => [String])
    requiredAuthorityActions!: Array<string>

    /** The real person the persona is modelled on, or null. */
    @Field(() => String, { nullable: true })
    personName!: string | null
}
