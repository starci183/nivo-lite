import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** Posts an owner message in the open draft of the setup chat. */
export class PostSetupMessageInput {
    /** The open draft. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    setupSessionId!: string

    /** The message. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    text!: string
}
