import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Saves the holding message of an agent; an empty text removes it. */
export class SaveHoldingMessageInput {
    /** The installation. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** The holding message. */
    @Field()
    @IsString()
    @MaxLength(400)
    value!: string
}
