import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What saving provider keys answers. */
export class ProviderKeysResultType {
    /** Whether payOS confirmed the webhook address. */
    @Field(() => Boolean)
    confirmed!: boolean

    /** True on a local site, where the confirmation is skipped. */
    @Field(() => Boolean)
    localOnly!: boolean
}
