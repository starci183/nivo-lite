import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsString, MaxLength } from "class-validator"
import type { WorkspaceFilter } from "@modules/domain/platform-admin"

@InputType()
/** The bounded arguments of the workspace list. */
export class AdminWorkspacesInput {
    /** Which workspaces to keep: all, attention, unpaid or idle. */
    @Field()
    @IsIn(["all", "attention", "unpaid", "idle"])
    filter: WorkspaceFilter = "all"

    /** Free text matched against the name, the owner email and the start of the id. */
    @Field()
    @IsString()
    @MaxLength(120)
    query: string = ""
}
