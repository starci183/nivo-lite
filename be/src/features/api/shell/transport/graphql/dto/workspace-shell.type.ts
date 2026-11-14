import { Field, ObjectType } from "@nestjs/graphql"
import { ShellAgentType } from "./shell-agent.type"

@ObjectType()
/** What the console frame draws. */
export class WorkspaceShellType {
    /** The installed agents. */
    @Field(() => [ShellAgentType])
    agents!: Array<ShellAgentType>

    /** Whether the workspace bought a module inside the Founding window. */
    @Field()
    isFoundingMember!: boolean
}
