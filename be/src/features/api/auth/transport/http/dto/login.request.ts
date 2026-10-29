import { IsEmail, IsString, MaxLength, MinLength } from "class-validator"

/** The posted sign-in pair. */
export class LoginRequest {
    /** The sign-in address. */
    @IsEmail()
    @MaxLength(254)
    email!: string

    /** The password. */
    @IsString()
    @MinLength(1)
    @MaxLength(128)
    password!: string
}
