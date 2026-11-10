import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Who of the shop set or cleared a customer's opt-out, when, and what it came to. */
export class CareOptOutPressType {
    /** The workspace member who pressed. */
    @Field(() => ID)
    memberId!: string

    /** Their name as it read when they pressed. */
    @Field(() => String)
    memberName!: string

    /** set or unchanged. */
    @Field(() => String)
    outcome!: string

    /** When. */
    @Field(() => Date)
    at!: Date
}

@ObjectType()
/** A customer's care opt-out as it stands, with the last press of the shop's door. */
export class CareOptOutType {
    /** The customer (lead). */
    @Field(() => ID)
    leadId!: string

    /** True when nobody writes to the customer unprompted. */
    @Field(() => Boolean)
    optedOut!: boolean

    /** The last time a person of the shop set or cleared it, or null (only the customer's own words set it so far). */
    @Field(() => CareOptOutPressType, { nullable: true })
    lastPress!: CareOptOutPressType | null
}

@ObjectType()
/** What setting a customer's care opt-out did. */
export class SetCareOptOutType {
    /** set, unchanged (it already stood so; the press is still recorded) or not_found. */
    @Field(() => String)
    outcome!: string

    /** The opt-out after the call, or null when the customer is not found. */
    @Field(() => CareOptOutType, { nullable: true })
    careOptOut!: CareOptOutType | null
}

@ObjectType()
/** What handing a conversation back did. */
export class ConversationReleaseType {
    /** released, nothing_held or not_found. */
    @Field(() => String)
    outcome!: string

    /** The person whose take-over was cleared, or null. */
    @Field(() => String, { nullable: true })
    person!: string | null

    /** The agent whose consult hold was cleared, or null. */
    @Field(() => ID, { nullable: true })
    agentId!: string | null
}
