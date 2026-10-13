import type { DbOutcome } from "@/modules/db/outcome"
import type { CreatedWorkspaceItem } from "@/modules/db/workspaces/workspaces.mapper"
import { writeCreateWorkspace } from "@/modules/db/workspaces/write-create-workspace"

/** Creates a free workspace owned by the signed-in person through the database. */
export const useCreateWorkspace = (): ((name: string) => Promise<DbOutcome<CreatedWorkspaceItem>>) =>
    writeCreateWorkspace
