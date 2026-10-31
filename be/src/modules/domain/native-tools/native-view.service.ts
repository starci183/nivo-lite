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

    /**
     * The view of a caller of an internal tool: the same as `of`, and a customer conversation or an agent whose view is the
     * customer's is refused `internal_only`. The gateway hides and refuses these tools first; this keeps them closed if it ever does not.
     */
    async internalOf(workspaceId: string, caller: NativeCaller): Promise<NativeView> {
        if (caller.conversationId !== null) throw nativeRefusal("internal_only")
        const view = await this.of(workspaceId, caller)
        if (view.audience === "customer") throw nativeRefusal("internal_only")
        return view
    }
}
