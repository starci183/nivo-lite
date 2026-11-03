import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The current password and the one that replaces it. */
export class ChangePasswordInput {
    /** The password the person signs in with today. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    currentPassword!: string

    /** The new password, 8 to 72 bytes. */
    @Field()
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    newPassword!: string
}
