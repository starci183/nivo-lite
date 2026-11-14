import { Injectable } from "@nestjs/common"
import { WorkspaceMembersService, type WorkspaceRole } from "@modules/domain/workspace-members"
import type { ApproverDirectoryEntry } from "./approver-directory.contracts"

/** Who may read the directory: the owner and the managers. */
const MANAGERS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/**
 * The people an approver group of a graph could name: none. Approver groups served the authority rules, which decide nothing since the
 * engine gate was removed (2026-11-13); the door the web still reads stays, owner and manager only, and answers an empty list.
 */
export class ApproverDirectoryService {
    constructor(private readonly members: WorkspaceMembersService) {}

    /** Proves the caller is an owner or manager of the workspace, then answers the empty directory. */
    async list(principalId: string, workspaceId: string): Promise<ReadonlyArray<ApproverDirectoryEntry>> {
        await this.members.require(principalId, workspaceId, MANAGERS)
        return []
    }
}
