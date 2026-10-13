import { IsUUID, MaxLength } from "class-validator"

/** The bounded path parameter that names an approval card. */
export class ExecutionIdRequest {
    /** The approval card. */
    @IsUUID("4")
    @MaxLength(36)
    executionId!: string
}
