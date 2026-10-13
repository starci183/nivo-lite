import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { MANAGER_COMMANDS } from "./flows.contracts"
import type { FlowGate, FlowRequest, FlowResult } from "./flows.contracts"
import { InjectFlowGate } from "./flows.decorators"
import { payloadOf } from "./policies/flow-payload.policy"

const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/**
 * The doors of the operating flow for a signed-in member: the authority the owner grants, the rules, the staff, and the decisions
 * on the work waiting in Office. The service proves who may ask (managers for what changes the rules, any member for the rest,
 * the engine decides which work a staff member may decide) and hands the command to the flow engine.
 */
export class FlowsService {
    constructor(
        private readonly members: WorkspaceMembersService,
        @InjectFlowGate() private readonly gate: FlowGate,
    ) {}

    /** Runs one flow command as the member; commands that change the rules are for owners and managers only. */
    async run(userId: string, workspaceId: string, request: FlowRequest): Promise<FlowResult> {
        const member = await this.members.require(
            userId,
            workspaceId,
            MANAGER_COMMANDS.includes(request.kind) ? MANAGERS : [],
        )
        return this.gate.run({ kind: request.kind, workspaceId, member, payload: payloadOf(request.payload) })
    }
}
