import { IsUUID, MaxLength } from "class-validator"

/** The bounded path parameter that names a work item. */
export class WorkItemIdRequest {
    /** The work item. */
    @IsUUID("4")
    @MaxLength(36)
    workItemId!: string
}
