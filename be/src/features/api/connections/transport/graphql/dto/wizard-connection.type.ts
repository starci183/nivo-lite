import { Field, ID, ObjectType } from "@nestjs/graphql"
import { FirstEventType } from "./first-event.type"

@ObjectType()
/** The wizard view of a bank or payment feed. */
export class WizardConnectionType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The provider. */
    @Field(() => String)
    provider!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** `test` or `live`. */
    @Field(() => String)
    environment!: string

    /** The status. */
    @Field(() => String)
    status!: string

    /** The address the provider must call. */
    @Field(() => String)
    webhookUrl!: string

    /** SePay only: the API key to paste into SePay. */
    @Field(() => String)
    apiKey!: string

    /** The bank code. */
    @Field(() => String)
    bankCode!: string

    /** The masked account number. */
    @Field(() => String)
    account!: string

    /** The account holder. */
    @Field(() => String)
    holder!: string

    /** Whether the provider keys were saved. */
    @Field(() => Boolean)
    credentialsSaved!: boolean

    /** The first event the feed accepted. */
    @Field(() => FirstEventType, { nullable: true })
    firstEvent!: FirstEventType | null

    /** The agents that use it. */
    @Field(() => [ID])
    agentIds!: ReadonlyArray<string>
}
