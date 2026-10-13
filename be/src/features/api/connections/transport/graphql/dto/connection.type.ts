import { Field, ID, ObjectType } from "@nestjs/graphql"
import { FirstEventType } from "./first-event.type"
import { ConnectionGrantType } from "./connection-grant.type"
import { StringMapScalar } from "./string-map.scalar"

@ObjectType()
/** One connection of a workspace, without any secret. */
export class ConnectionType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The workspace that owns it. */
    @Field(() => ID)
    workspaceId!: string

    /** The provider key. */
    @Field(() => String)
    provider!: string

    /** The name the owner gave it. */
    @Field(() => String)
    name!: string

    /** Non-secret facts: bot_username, account_masked, bank_code, oa_id ... */
    @Field(() => StringMapScalar)
    meta!: Readonly<Record<string, string>>

    /** `pending`, `connected`, `error` or `disconnected`. */
    @Field(() => String)
    status!: string

    /** The last failure shown to the owner. */
    @Field(() => String, { nullable: true })
    lastError!: string | null

    /** `test` or `live`. */
    @Field(() => String)
    environment!: string

    /** SMTP only: the workspace default sender. */
    @Field(() => Boolean)
    isDefault!: boolean

    /** When the last event arrived, ISO 8601. */
    @Field(() => String, { nullable: true })
    lastEventAt!: string | null

    /** The first event it accepted. */
    @Field(() => FirstEventType, { nullable: true })
    firstEvent!: FirstEventType | null

    /** Who created it. */
    @Field(() => ID, { nullable: true })
    createdBy!: string | null

    /** When it was created, ISO 8601. */
    @Field(() => String)
    createdAt!: string

    /** The agents that use it. */
    @Field(() => [ID])
    agentIds!: ReadonlyArray<string>

    /** Each agent access level through it. */
    @Field(() => [ConnectionGrantType])
    grants!: ReadonlyArray<ConnectionGrantType>
}
