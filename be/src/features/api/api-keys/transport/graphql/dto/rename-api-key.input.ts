import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** The key to rename and its new name. */
export class RenameApiKeyInput {
    /** The id of the key. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    keyId!: string

    /** The new name (trimmed to 60 characters, at least 2). */
    @Field()
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    name!: string
}
