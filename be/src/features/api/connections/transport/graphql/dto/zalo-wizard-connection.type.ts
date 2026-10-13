import { Field, ID, ObjectType } from "@nestjs/graphql"
import { FirstEventType } from "./first-event.type"

@ObjectType()
/** The wizard view of a Zalo OA connection; the keys are never returned. */
export class ZaloWizardConnectionType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The status. */
    @Field(() => String)
    status!: string

    /** The webhook address to register on the Zalo app. */
    @Field(() => String)
    webhookUrl!: string

    /** The callback address to register on the Zalo app. */
    @Field(() => String)
    callbackUrl!: string

    /** The OA has been authorized. */
    @Field(() => Boolean)
    authorized!: boolean

    /** The OA secret key was saved. */
    @Field(() => Boolean)
    oaSecretSaved!: boolean

    /** The Official Account id. */
    @Field(() => String)
    oaId!: string

    /** The first event it accepted. */
    @Field(() => FirstEventType, { nullable: true })
    firstEvent!: FirstEventType | null

    /** The agents that use it. */
    @Field(() => [ID])
    agentIds!: ReadonlyArray<string>
}
