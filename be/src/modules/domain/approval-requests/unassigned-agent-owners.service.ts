import { Injectable } from "@nestjs/common"
import type { AgentOwnerRef, ApprovalAgentOwners } from "./approval-requests.port"

@Injectable()
/**
 * The owners of the agents while agents carry no assigned person: nobody. A request that ran out of time then falls to the
 * workspace owner, the default of the plan. The app root binds the agents capability instead (`ports.agentOwners`) once an agent
 * carries its owner and its fallback.
 */
export class UnassignedApprovalAgentOwners implements ApprovalAgentOwners {
    /** No agent has an assigned person yet. */
    ownerOf(): Promise<AgentOwnerRef> {
        return Promise.resolve({ ownerMemberId: null, fallbackMemberId: null })
    }
}
