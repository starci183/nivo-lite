import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The website intake: what the owner pastes and switches. */
export class WebsiteSiteType {
    /** The public key in the address the form posts to. */
    @Field()
    siteKey!: string

    /** The intake is on. */
    @Field()
    isEnabled!: boolean

    /** The site shows the chat button. */
    @Field()
    chatEnabled!: boolean

    /** The site shows the order form. */
    @Field()
    formEnabled!: boolean

    /** The site shows the price list. */
    @Field()
    pricesEnabled!: boolean

    /** The agent that receives the customers, or null. */
    @Field(() => ID, { nullable: true })
    agentId!: string | null

    /** The address of the hosted form a visitor fills in. */
    @Field()
    formUrl!: string
}
