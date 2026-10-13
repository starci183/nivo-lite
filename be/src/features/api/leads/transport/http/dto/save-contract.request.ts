import { IsIn, IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateIf } from "class-validator"

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const STATUSES = ["active", "ended", "cancelled"] as const

/** The bounded HTTP request of save-contract: a recurring contract with real days, a status and an optional amount. */
export class SaveContractRequest {
    /** The contract to edit; null adds a new one. */
    @ValidateIf((request: SaveContractRequest) => request.contractId !== null)
    @IsUUID("4")
    @MaxLength(36)
    contractId!: string | null

    /** The customer the contract links to, when one is known. */
    @ValidateIf((request: SaveContractRequest) => request.leadId !== null)
    @IsUUID("4")
    @MaxLength(36)
    leadId!: string | null

    /** The customer name. */
    @IsString()
    @MaxLength(200)
    customerName!: string

    /** The plan the customer buys. */
    @IsString()
    @MaxLength(200)
    plan!: string

    /** The first day, YYYY-MM-DD. */
    @Matches(DAY_PATTERN)
    @MaxLength(10)
    startsOn!: string

    /** The last day, YYYY-MM-DD. */
    @Matches(DAY_PATTERN)
    @MaxLength(10)
    endsOn!: string

    /** The recurring amount in whole dong; null when not agreed. */
    @ValidateIf((request: SaveContractRequest) => request.amountVnd !== null)
    @IsInt()
    @Min(0)
    @Max(Number.MAX_SAFE_INTEGER)
    amountVnd!: number | null

    /** `active`, `ended` or `cancelled`. */
    @IsIn(STATUSES)
    @MaxLength(20)
    status!: string

    /** A free note. */
    @IsString()
    @MaxLength(600)
    note!: string
}
