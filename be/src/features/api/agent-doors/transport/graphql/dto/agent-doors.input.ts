import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

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
/** Which conversation to hand back to the agents. The conversation is named by its route (the `routeId` of the chat the workbench reads). */
export class ReleaseConversationInput {
    /** The route of the conversation: the engine's id of the person on the entrance, the `routeId` of the chat. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    conversationId!: string
}
