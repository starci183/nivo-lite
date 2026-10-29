import { mock } from "@starci/jest-preset"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"

/** The name and the environment a connection runs in. */
interface FeedState {
    readonly name: string
    readonly environment: string
}

/** What the connection tables answer: a key set to undefined is a missing row. */
export interface FeedWorld {
    /** The connection row that names the workspace. */
    readonly owner: { readonly workspace_id: string } | undefined
    /** The name and environment of the connection. */
    readonly state: FeedState | undefined
    /** The accounting agent bound to the connection for its bank feed. */
    readonly agent: { readonly id: string } | undefined
}

const LIVE_STATE = { name: "Bank", environment: "live" }
const TEST_STATE = { name: "Test", environment: "test" }

/** A live connection of workspace ws-1 whose bank feed the accounting agent agent-1 reads. */
export const FEED_WORLD: FeedWorld = { owner: { workspace_id: "ws-1" }, state: LIVE_STATE, agent: { id: "agent-1" } }
export const NO_STATE: Partial<FeedWorld> = { state: undefined }
export const NO_AGENT: Partial<FeedWorld> = { agent: undefined }
export const NO_OWNER: Partial<FeedWorld> = { owner: undefined }
export const TEST_ENVIRONMENT: Partial<FeedWorld> = { state: TEST_STATE }

/** The connection and binding owners answering the world of one scenario. */
export const feedOwnersOf = (feedWorld: FeedWorld) => {
    const connections = mock<ConnectionBindingsReadService>()
    connections.workspaceOf.mockResolvedValue(feedWorld.owner?.workspace_id ?? null)
    connections.stateOf.mockResolvedValue(feedWorld.state ?? null)
    const bindings = mock<AgentBindingsService>()
    bindings.agentsFor.mockResolvedValue(
        feedWorld.agent === undefined
            ? []
            : [
                  {
                      id: feedWorld.agent.id,
                      module: "accounting",
                      name: "Accountant",
                      access: "auto",
                      purpose: "bank_feed",
                  },
              ],
    )
    return { connections, bindings }
}

/** The members owner answering that user-1 owns workspace ws-1. */
export const owningMembers = () => {
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
    return members
}
