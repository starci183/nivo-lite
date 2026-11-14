import { Field, ObjectType } from "@nestjs/graphql"
import { ConnectionFieldWordsType, ConnectionFieldsType } from "./get-connection-fields.type"

@ObjectType()
/** One member of an action's answer. */
export class ConnectionActionValueType {
    /** The key of the member. */
    @Field(() => String)
    key!: string

    /** Its label. */
    @Field(() => ConnectionFieldWordsType)
    label!: ConnectionFieldWordsType

    /** Its value, or null where the provider does not say. */
    @Field(() => String, { nullable: true })
    value!: string | null
}

@ObjectType()
/** What running an action answers: its result members and the form again. */
export class ConnectionActionResultType {
    /** The action run. */
    @Field(() => String)
    action!: string

    /** Its result members, in declared order. */
    @Field(() => [ConnectionActionValueType])
    results!: ReadonlyArray<ConnectionActionValueType>

    /** The form of the account after the action. */
    @Field(() => ConnectionFieldsType)
    form!: ConnectionFieldsType
}
