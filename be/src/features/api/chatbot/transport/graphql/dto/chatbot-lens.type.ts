import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An active agent providing an audience lens on the brain. */
export class ChatbotLensType {
    /** The module value. */
    @Field(() => String)
    module!: string

    /** The name value. */
    @Field(() => String)
    name!: string

    /** The audience value. */
    @Field(() => String)
    audience!: string
}
