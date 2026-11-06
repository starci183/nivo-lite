import { Injectable } from "@nestjs/common"
import { WorkspacesService } from "@modules/domain/workspaces"
import { WORKSPACE_SLICE } from "./policies/agent-runs.policy"

@Injectable()
/**
 * Which workspaces a pass looks at. The engine scopes a transaction to one workspace, so the sweep and the resume of parked runs visit the
 * workspaces one scope each: a slice of them by id, then the next slice on the next pass, wrapping round after the last, so every
 * workspace is reached and no pass reads more than a slice.
 */
export class AgentRunWorkspacesService {
    private after: string | undefined

    constructor(private readonly workspaces: WorkspacesService) {}

    /** The ids of the next slice of workspaces; the slice after the last is the first again. */
    async next(): Promise<ReadonlyArray<string>> {
        const found = await this.workspaces.list(WORKSPACE_SLICE, this.after)
        this.after = found.length < WORKSPACE_SLICE ? undefined : found.at(-1)?.id
        return found.map((workspace) => workspace.id)
    }
}
