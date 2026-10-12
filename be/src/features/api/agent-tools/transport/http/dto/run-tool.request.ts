import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

/**
 * The bounded body of a tool call: the union of the arguments of every tool in the manifest, flat as the agent sends them. Every
 * argument is optional here; the tool policy requires and clips the ones its tool needs.
 */
export class RunToolRequest {
    /** knowledge.search: the question. */
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    query?: string

    /** lead.create_or_update, booking.request: the customer's name. */
    @IsOptional()
    @IsString()
    @MaxLength(500)
    contact_name?: string

    /** lead.create_or_update: what the customer needs. */
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    need?: string

    /** lead.create_or_update: the customer's company. */
    @IsOptional()
    @IsString()
    @MaxLength(500)
    company?: string

    /** lead.create_or_update: the customer's phone. */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    phone?: string

    /** lead.create_or_update: the customer's email. */
    @IsOptional()
    @IsString()
    @MaxLength(500)
    email?: string

    /** approval.request: the customer's question. */
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    question?: string

    /** approval.request: the answer the agent proposes. */
    @IsOptional()
    @IsString()
    @MaxLength(6000)
    proposed_answer?: string

    /** approval.request, handoff.to_person: why. */
    @IsOptional()
    @IsString()
    @MaxLength(1200)
    reason?: string

    /** booking.find_slots: the service. */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    service?: string

    /** booking.find_slots: the date. */
    @IsOptional()
    @IsString()
    @MaxLength(40)
    date?: string

    /** booking.find_slots: how many people. */
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(1000)
    party_size?: number

    /** booking.request: the slot the customer picked. */
    @IsOptional()
    @IsString()
    @MaxLength(100)
    slot?: string

    /** booking.request: how to reach the customer. */
    @IsOptional()
    @IsString()
    @MaxLength(500)
    contact?: string

    /** booking.request: a note for the business. */
    @IsOptional()
    @IsString()
    @MaxLength(2000)
    note?: string
}
