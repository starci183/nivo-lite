import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsUUID, MaxLength, ValidateNested } from "class-validator"
import { CardDecisionInput } from "./card-decision.input"

@InputType()
/** Decides one confirm card of the setup chat. */
export class DecideSetupCardInput {
    /** The card. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    cardId!: string

    /** The decision with the edits. */
    @Field(() => CardDecisionInput)
    @ValidateNested()
    @Type(() => CardDecisionInput)
    change!: CardDecisionInput
}
