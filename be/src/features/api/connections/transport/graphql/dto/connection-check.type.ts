import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What asking a provider about a connection answers. */
export class ConnectionCheckType {
    /** The provider. */
    @Field(() => String)
    provider!: string

    /** The provider knows our webhook address. */
    @Field(() => Boolean)
    webhookOk!: boolean

    /** The site is not public, so providers cannot call it. */
    @Field(() => Boolean)
    localOnly!: boolean

    /** Updates the provider holds for us. */
    @Field(() => Int)
    pending!: number

    /** The last delivery error the provider reported. */
    @Field(() => String, { nullable: true })
    lastError!: string | null
}
