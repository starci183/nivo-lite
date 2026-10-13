import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request that keeps the value in force. */
export class KeepCurrentRequest {
    /** The normalised subject. */
    @IsString()
    @MaxLength(120)
    subjectKey!: string

    /** The normalised attribute. */
    @IsString()
    @MaxLength(120)
    attribute!: string

    /** The agent instance the key is scoped to. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    installationId?: string
}
