import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** How the owner's answer to a frozen customer ended. */
export class DecideLeadFreezeType {
    /** `on_stop` or `not_found`. */
    @Field(() => String)
    outcome!: string
}
