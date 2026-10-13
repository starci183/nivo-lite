import { Field, Int, ObjectType } from "@nestjs/graphql"
import { DataJsonScalar } from "./data-json.type"

@ObjectType()
/** A saved API connection as the wizard reopens it; never holds a secret. */
export class OpenApiConnectionType {
    /** The connection name. */
    @Field(() => String)
    name!: string

    /** The saved configuration: {v, specUrl, baseUrl, authType, authName, ops, pulls, tools}. */
    @Field(() => DataJsonScalar)
    config!: unknown

    /** Minutes between scheduled syncs; null is manual only. */
    @Field(() => Int, { nullable: true })
    syncEveryMinutes!: number | null

    /** True when a key, token or password is stored. */
    @Field(() => Boolean)
    hasSecret!: boolean

    /** The stored basic-auth user (not a secret). */
    @Field(() => String)
    authUser!: string
}
