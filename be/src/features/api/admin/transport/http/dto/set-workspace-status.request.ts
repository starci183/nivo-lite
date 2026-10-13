import { IsIn } from "class-validator"
import type { SupportStatus } from "@modules/domain/workspaces"

/** The bounded HTTP request of setWorkspaceStatus. */
export class SetWorkspaceStatusRequest {
    /** The billing status to set. */
    @IsIn(["active", "past_due"])
    status!: SupportStatus
}
