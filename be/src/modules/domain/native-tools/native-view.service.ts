import { Injectable } from "@nestjs/common"
import { AgentViewScopeService } from "@modules/domain/agents"
import type { NativeCaller } from "@modules/domain/mcp-gateway"
import { nativeRefusal } from "./native-refusal.policy"
import { viewOfCall } from "./native-view.policy"
import type { NativeView } from "./native-view.policy"

@Injectable()
/** Reads the view one native call answers for from the caller's agent: its module and instance, and the audience its lens allows. */
export class NativeViewService {
    constructor(private readonly scopes: AgentViewScopeService) {}

    /** The view of the caller in the workspace; an agent the workspace does not hold is `not_found`. */
    async of(workspaceId: string, caller: NativeCaller): Promise<NativeView> {
        const scope = await this.scopes.lensOf(workspaceId, caller.agentId)
        if (scope === null) throw nativeRefusal("not_found")
        return viewOfCall(workspaceId, scope, caller.conversationId)
    }
}
