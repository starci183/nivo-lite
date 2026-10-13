import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Asks for a command card for an owner message. */
export class ProposeOfficeCommandInput {
    /** The owner message, already stored in the Office thread. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    messageId!: string
}
