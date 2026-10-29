import type { MockOf } from "@starci/jest-preset"
import type { AgentBindingsService } from "@modules/domain/agent-connections"
import type { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { WorkspaceMembersService } from "@modules/domain/workspace-members"

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

/** Makes the connection and binding owners answer the world of one scenario. */
export const arrangeFeedOwners = (
    feedWorld: FeedWorld,
    connections: MockOf<ConnectionBindingsReadService>,
    bindings: MockOf<AgentBindingsService>,
): void => {
    connections.workspaceOf.mockResolvedValue(feedWorld.owner?.workspace_id ?? null)
    connections.stateOf.mockResolvedValue(feedWorld.state ?? null)
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
}

/** Makes the members owner answer that user-1 owns workspace ws-1. */
export const arrangeOwningMember = (members: MockOf<WorkspaceMembersService>): void => {
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "owner",
        staffId: null,
        displayName: "Lan",
        status: "active",
    })
}
