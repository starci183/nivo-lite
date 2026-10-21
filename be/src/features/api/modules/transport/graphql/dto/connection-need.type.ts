import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType("ConnectionNeed")
/** A capability role an installed agent requires that no usable connector plays yet, with the connectors that could play it. */
export class ConnectionNeedType {
    /** The missing capability role, for example payment.credits.list. */
    @Field(() => String)
    role!: string

    /** The display names of the workspace's connectors that declare the role (installed or installable). */
    @Field(() => [String])
    providers!: ReadonlyArray<string>
}
