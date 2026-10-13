import { IsIn } from "class-validator"

/** The bounded HTTP request that moves a responsibility to a status. */
export class UpdateResponsibilityStatusRequest {
    /** The status to move it to. */
    @IsIn(["open", "waiting_approval", "done"])
    status!: "open" | "waiting_approval" | "done"
}
