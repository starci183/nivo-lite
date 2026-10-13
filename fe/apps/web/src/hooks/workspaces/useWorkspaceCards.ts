import { useQueryMyWorkspacesSwr } from "@/hooks/swr/api/graphql/queries/useQueryMyWorkspacesSwr"
import { workspaceRoleOf, workspaceStateOf } from "./workspaces.shared"
import type { WorkspaceCardView } from "./workspaces.shared"

/** Where the workspaces list stands: still loading, failed, loaded empty, or loaded with workspaces. */
export type WorkspacesStatus = "loading" | "error" | "empty" | "ready"

/** What the workspaces list readers get. */
interface WorkspaceCards {
    readonly cards: ReadonlyArray<WorkspaceCardView>
    readonly status: WorkspacesStatus
    /** The failure text (localized by the back end) when the status is `error`. */
    readonly error: string | undefined
}

/** The signed-in person's usable workspaces as the screens draw them, read from the back end GraphQL API through SWR. */
export const useWorkspaceCards = (): WorkspaceCards => {
    const { data, error, isLoading } = useQueryMyWorkspacesSwr()
    const cards = (data ?? [])
        .filter((membership) => membership.member.status === "active")
        .map((membership): WorkspaceCardView => ({
            id: membership.workspace.id,
            name: membership.workspace.name,
            role: workspaceRoleOf(membership.member.role),
            state: workspaceStateOf(membership.workspace.status),
        }))
    const failure = error instanceof Error ? error.message : undefined
    if (isLoading) return { cards, status: "loading", error: undefined }
    if (error !== undefined) return { cards, status: "error", error: failure ?? "" }
    return { cards, status: cards.length === 0 ? "empty" : "ready", error: undefined }
}
