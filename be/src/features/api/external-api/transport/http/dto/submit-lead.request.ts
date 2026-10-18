import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from "class-validator"
import { LEAD_STAGES, TrimmedField } from "@modules/domain/public-api"
import type { LeadStage } from "@modules/domain/public-api"

/** A phone number, or empty. */
const PHONE = /^$|^[+\d][\d\s().-]{5,}$/

/** An email address, or empty. */
const EMAIL = /^$|^[^@\s]+@[^@\s](?=[^@\s]*\.[^@\s])[^@\s]+$/

/** The JSON body of POST /api/v1/leads: a customer to hand over to the sales flow. */
export class SubmitLeadRequest {
    /** The customer's name. */
    @TrimmedField()
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name!: string

    /** The phone number. */
    @IsOptional()
    @TrimmedField()
    @IsString()
    @MaxLength(30)
    @Matches(PHONE)
    phone?: string

    /** The email address. */
    @IsOptional()
    @TrimmedField()
    @IsString()
    @MaxLength(120)
    @Matches(EMAIL)
    email?: string

    /** The company. */
    @IsOptional()
    @TrimmedField()
    @IsString()
    @MaxLength(120)
    company?: string

    /** What the customer needs. */
    @IsOptional()
    @TrimmedField()
    @IsString()
    @MaxLength(500)
    need?: string

    /** The channel the customer came through. */
    @IsOptional()
    @TrimmedField()
    @IsString()
    @MaxLength(60)
    channel?: string

    /** The caller's own id of the customer: a repeat with the same id is one customer. */
    @IsOptional()
    @TrimmedField()
    @IsString()
    @MaxLength(100)
    external_id?: string

    /** A note for the customer's history. */
    @IsOptional()
    @TrimmedField()
    @IsString()
    @MaxLength(1000)
    note?: string

    /** The stage to put the customer in. */
    @IsOptional()
    @TrimmedField()
    @IsIn([...LEAD_STAGES, ""])
    @MaxLength(20)
    stage?: LeadStage | ""
}
