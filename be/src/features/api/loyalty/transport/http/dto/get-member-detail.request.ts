import { IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP params of get-member-detail. */
export class GetMemberDetailParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The customer id. */
    @IsUUID()
    @MaxLength(36)
    customerId!: string
}
