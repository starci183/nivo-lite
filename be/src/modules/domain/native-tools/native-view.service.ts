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
     * customer's is refused `internal_only`. A workflow step (`graphStep`) is judged by its agent alone: the conversation it carries is
     * its run's, so the step of an internal agent passes whoever started the run, and the step of a customer-facing agent never does.
     * The engine's own caller (`engine`: a module's declared job run as the workspace's internal agent, outside any conversation) is
     * internal by what it is: its agent's module is no module of the catalogue, which would otherwise read as customer-facing and
     * refuse every job its internal tools (the ledger status the ledger copy asks first).
     * The gateway hides and refuses these tools first; this keeps them closed if it ever does not.
     */
    async internalOf(workspaceId: string, caller: NativeCaller): Promise<NativeView> {
        const step = caller.graphStep === true
        if (caller.conversationId !== null && !step) throw nativeRefusal("internal_only")
        const view = await this.of(workspaceId, step ? { ...caller, conversationId: null } : caller)
        if (caller.engine === true) return { ...view, audience: "internal" }
        if (view.audience === "customer") throw nativeRefusal("internal_only")
        return view
    }
}
