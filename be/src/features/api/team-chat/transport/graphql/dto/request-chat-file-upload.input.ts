import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** Asks for the address to upload one file of a room to. */
export class RequestChatFileUploadInput {
    /** The room. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    roomId!: string

    /** The name of the file on the sender side. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    fileName!: string

    /** The declared type; the service refuses one a message may not carry. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    mimeType!: string

    /** The declared size in bytes; the service refuses one over 25 MB. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(2_147_483_647)
    sizeBytes!: number
}
