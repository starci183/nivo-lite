import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator"
import { TrimmedField, TrueField } from "@modules/domain/public-api"

/** A UUID, or empty. */
const UUID_OR_EMPTY = /^$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The JSON body of POST /api/v1/messages: a message for the chatbot to send to a customer. */
export class SendMessageRequest {
    /** The text to send. */
    @TrimmedField()
    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    text!: string

    /** The customer conversation to message. */
    @IsOptional()
    @TrimmedField()
    @IsString()
    @MaxLength(36)
    @Matches(UUID_OR_EMPTY)
    conversation_id?: string

    /** The customer whose latest conversation to use when no conversation is named. */
    @IsOptional()
    @TrimmedField()
    @IsString()
    @MaxLength(36)
    @Matches(UUID_OR_EMPTY)
    lead_id?: string

    /** True forces a waiting decision whatever the owner's rule says; the string "true" counts as true. */
    @IsOptional()
    @TrueField()
    @IsBoolean()
    require_approval?: boolean
}
