import { IsEmail, MaxLength } from "class-validator"

/** An address to mail a link to. */
export class EmailRequest {
    /** The address. */
    @IsEmail()
    @MaxLength(254)
    email!: string
}
