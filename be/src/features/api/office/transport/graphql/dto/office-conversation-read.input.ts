import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, MaxLength } from "class-validator"
import type { ConversationKind } from "@modules/domain/office-rooms"

@InputType()
/** Names one direct conversation of the Hub list. */
export class OfficeConversationReadInput {
    /** Which direct conversation: `agent` for one agent's lines, `lead` for one customer's. */
    @Field(() => String)
    @IsIn(["agent", "lead"])
    kind!: ConversationKind

    /** The agent or lead id of the conversation. */
    @Field(() => ID)
    @MaxLength(40)
    id!: string
}
