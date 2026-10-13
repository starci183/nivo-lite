import { Field, Int, ObjectType } from "@nestjs/graphql"
import { ShellAgentType } from "./shell-agent.type"
import { ShellApprovalType } from "./shell-approval.type"
import { ShellExceptionType } from "./shell-exception.type"

@ObjectType()
/** The counts and lists the console frame draws. */
export class WorkspaceShellType {
    /** How many customers the workspace has. */
    @Field(() => Int)
    leadCount!: number

    /** How many responsibilities are still open. */
    @Field(() => Int)
    openResponsibilityCount!: number

    /** The installed agents. */
    @Field(() => [ShellAgentType])
    agents!: Array<ShellAgentType>

    /** Whether a chatbot agent is installed. */
    @Field()
    hasChatbot!: boolean

    /** Whether the workspace bought a module inside the Founding window. */
    @Field()
    isFoundingMember!: boolean

    /** Drafts waiting for approval, newest first. */
    @Field(() => [ShellApprovalType])
    approvals!: Array<ShellApprovalType>

    /** Work items waiting or failed that have no approval card. */
    @Field(() => [ShellExceptionType])
    exceptions!: Array<ShellExceptionType>

    /** Decisions waiting on a person. */
    @Field(() => Int)
    pendingDecisions!: number
}
