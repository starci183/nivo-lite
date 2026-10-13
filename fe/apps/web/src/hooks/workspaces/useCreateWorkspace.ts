import type { CreatedWorkspaceItem, Outcome } from "@/modules/api"
import { writeCreateWorkspace } from "@/modules/db/workspaces/write-create-workspace"

/** Creates a free workspace owned by the signed-in person through the back end api. */
export const useCreateWorkspace = (): ((name: string) => Promise<Outcome<CreatedWorkspaceItem>>) => writeCreateWorkspace
