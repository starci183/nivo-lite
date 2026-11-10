import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** Taps of one emoji on one message. */
export class ChatReactInput {
    /** The message. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    messageId!: string

    /** The emoji; one of the six the chat reacts with. */
    @Field(() => String)
    @IsString()
    @MaxLength(16)
    emoji!: string

    /** How many taps this call carries (a burst is sent as one call); omitted is one, at most 30. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(30)
    times: number | null = null
}
