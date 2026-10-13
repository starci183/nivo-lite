import { IsIn, IsString, MaxLength } from "class-validator"
import type { WorkspaceFilter } from "@modules/domain/platform-admin"

/** The bounded HTTP request of listWorkspaces. */
export class ListWorkspacesRequest {
    /** Which workspaces to keep. */
    @IsIn(["all", "attention", "unpaid", "idle"])
    filter: WorkspaceFilter = "all"

    /** Free text matched against the name, the owner's email and the start of the id. */
    @IsString()
    @MaxLength(120)
    query: string = ""
}
