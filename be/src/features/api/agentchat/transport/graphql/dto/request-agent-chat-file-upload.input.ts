import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded file facts used to authorize a signed upload for a chat message. */
export class RequestAgentChatFileUploadInput {
    /** The conversation the file belongs to. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    conversationId!: string

    /** The accepted type of the file. */
    @Field()
    @IsString()
    @MaxLength(32)
    @IsIn(["image/jpeg", "image/png", "image/webp", "application/pdf"])
    contentType!: string

    /** The file size in bytes, at most ten megabytes. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(10485760)
    sizeBytes!: number
}
