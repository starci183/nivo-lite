import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A person in charge of an agent. */
export class AgentOwnerCardType {
    /** The workspace member. */
    @Field(() => ID)
    memberId!: string

    /** The name the Office shows. */
    @Field()
    name!: string

    /** `owner`, `manager` or `staff`. */
    @Field()
    role!: string

    /** The key of the department room they sit in, or null. */
    @Field(() => String, { nullable: true })
    roomId?: string | null

    /** False when the member was disabled. */
    @Field()
    active!: boolean
}
