import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The customer facts linked to a conversation. */
export class ChatbotLeadType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The name value. */
    @Field(() => String)
    name!: string

    /** The company value. */
    @Field(() => String)
    company!: string

    /** The stage value. */
    @Field(() => String)
    stage!: string

    /** The need value. */
    @Field(() => String)
    need!: string

    /** The phone value. */
    @Field(() => String, { nullable: true })
    phone!: string | null

    /** The email value. */
    @Field(() => String, { nullable: true })
    email!: string | null
}
