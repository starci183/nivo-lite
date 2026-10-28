import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What the OA access token looks like to the owner; no token is ever returned. */
export class ZaloAccessType {
    /** none, valid, renewable or expired. */
    @Field(() => String)
    state!: string

    /** When the access token ends, ISO 8601. */
    @Field(() => String, { nullable: true })
    expiresAt!: string | null

    /** Whole minutes since the access token ended. */
    @Field(() => Int, { nullable: true })
    expiredMinutesAgo!: number | null

    /** A live refresh token can still renew the access token. */
    @Field(() => Boolean)
    canRefresh!: boolean
}
