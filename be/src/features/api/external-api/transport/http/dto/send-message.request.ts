import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator"
import { TrimmedField, TrueField } from "@modules/domain/public-api"

/** A UUID. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The JSON body of POST /api/v1/messages: a message for the chatbot to send to a customer. */
export class SendMessageRequest {
    /** The text to send. */
    @TrimmedField()
    @IsString()
    @IsNotEmpty()
    @MaxLength(2000)
    text!: string

    /** The person to message on their channel: the ROUTE id (the engine's id of this person on this account). The old name `conversation_id` is refused. */
    @TrimmedField()
    @IsString()
    @MaxLength(36)
    @Matches(UUID)
    route_id!: string

    /** True forces a waiting decision whatever the owner's rule says; the string "true" counts as true. */
    @IsOptional()
    @TrueField()
    @IsBoolean()
    require_approval?: boolean
}
