import { IsEmail, IsString, MaxLength, MinLength } from "class-validator"

/** A signup. */
export class SignupRequest {
    /** The display name. */
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The sign-in address. */
    @IsEmail()
    @MaxLength(254)
    email!: string

    /** The password. */
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    password!: string
}
