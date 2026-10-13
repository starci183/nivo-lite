import { IsIn, IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded HTTP request that approves (optionally with an edited draft) or rejects an approval card. */
export class DecideExecutionRequest {
    /** Approve or reject. */
    @IsIn(["approved", "rejected"])
    decision!: "approved" | "rejected"

    /** The draft the person edited; absent when they sent it as written. */
    @IsOptional()
    @IsString()
    @MaxLength(10000)
    editedDraft?: string
}
