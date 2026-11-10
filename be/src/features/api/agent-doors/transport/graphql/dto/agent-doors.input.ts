import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Which customer's care opt-out to read. */
export class CareOptOutInput {
    /** The customer (lead). */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    leadId!: string
}

@InputType()
/** The shop's word on a customer's care opt-out. */
export class SetCareOptOutInput {
    /** The customer (lead). */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    leadId!: string

    /** True: nobody writes to the customer unprompted (care steps close, customer sends are refused). False: clears it. */
    @Field(() => Boolean)
    @IsBoolean()
    optOut!: boolean
}

@InputType()
/** Which held conversation to hand back, and which hold. */
export class ReleaseConversationInput {
    /** The conversation. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    conversationId!: string

    /** person (a person's take-over), agent (an agent's consult hold) or both; absent is both. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsIn(["person", "agent", "both"])
    @MaxLength(10)
    hold?: string
}
