import { ArrayMaxSize, IsArray, IsEmail, IsObject, IsOptional, IsString, MaxLength } from "class-validator"

/** One email a shared workflow asks NIVO to send; the fields are cleaned before they are used. */
export class SendEmailRequest {
    /** The recipient. */
    @IsEmail()
    @MaxLength(254)
    to!: string

    /** The variables of the subject and the body. */
    @IsObject()
    variables!: object

    /** What the email is about. */
    @IsOptional()
    @IsObject()
    refs: object = {}

    /** Unique per email. */
    @IsOptional()
    @IsString()
    @MaxLength(120)
    dedupe?: string

    /** The attachments, at most two. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(2)
    attachments: Array<object> = []
}
