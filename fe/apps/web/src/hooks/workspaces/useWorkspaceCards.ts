import { useQueryMyWorkspacesSwr } from "@/hooks/swr"
import { readError } from "@/hooks/workspaceread"
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
    /** Reads the list again after a failure. */
    readonly reload: () => void
}

/** The signed-in person's usable workspaces as the screens draw them, read from the back end GraphQL API through SWR. */
export const useWorkspaceCards = (): WorkspaceCards => {
    const read = useQueryMyWorkspacesSwr()
    const { data, isLoading } = read
    const error = readError(read)
    const cards = (data ?? [])
        .filter((membership) => membership.member.status === "active")
        .map((membership): WorkspaceCardView => ({
            id: membership.workspace.id,
            name: membership.workspace.name,
            role: workspaceRoleOf(membership.member.role),
            state: workspaceStateOf(membership.workspace.status),
        }))
    const reload = () => void read.mutate()
    const failure = error instanceof Error ? error.message : undefined
    if (isLoading) return { cards, status: "loading", error: undefined, reload }
    if (error !== undefined) return { cards, status: "error", error: failure ?? "", reload }
    return { cards, status: cards.length === 0 ? "empty" : "ready", error: undefined, reload }
}
