import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP params of get-loyalty-overview. */
export class GetLoyaltyOverviewParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string
}
