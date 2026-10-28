import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The SePay API key and the address to paste it with. */
export class SepayKeyType {
    /** The SePay API key. */
    @Field(() => String)
    apiKey!: string

    /** The webhook address. */
    @Field(() => String)
    webhookUrl!: string
}
