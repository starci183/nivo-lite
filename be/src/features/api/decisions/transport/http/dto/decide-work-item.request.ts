import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator"
import { FieldValueRequest } from "./field-value.request"

/** What a person changed on a proposal before approving it. */
export class WorkEditsRequest {
    /** A new draft. */
    @IsOptional()
    @IsString()
    @MaxLength(10000)
    draft?: string

    /** A new amount, VND; null clears it. */
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000000000)
    amount_vnd?: number | null

    /** Changed fields. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @ValidateNested({ each: true })
    @Type(() => FieldValueRequest)
    fields?: Array<FieldValueRequest>

    /** The invoice the owner chose among the candidates. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    candidateId?: string
}

/** The bounded HTTP request that approves (optionally edited) or rejects a waiting work item. */
export class DecideWorkItemRequest {
    /** Approve or reject. */
    @IsIn(["approved", "rejected"])
    decision!: "approved" | "rejected"

    /** What the person changed before approving. */
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkEditsRequest)
    edits?: WorkEditsRequest

    /** A note from the decider. */
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    note?: string

    /** The written reason the outcome is true; required to approve a payment reconciliation. */
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    basis?: string
}
