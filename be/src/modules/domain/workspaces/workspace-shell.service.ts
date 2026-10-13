import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ShellRow } from "./persistence/workspace-shell.rows"
import { READ_SHELL } from "./persistence/workspace-shell.sql"
import { toShellFacts } from "./workspace-shell.mapper"
import type { ShellFacts, ShellWindow } from "./workspaces.contracts"

@Injectable()
/** The facts the console frame draws, read in one request for an active member of the workspace. */
export class WorkspaceShellService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly members: WorkspaceMembersService,
    ) {}

    /** The counts and lists of the workspace's console frame. */
    async read(userId: string, workspaceId: string, window: ShellWindow): Promise<ShellFacts> {
        await this.members.require(userId, workspaceId)
        const [row] = await this.entityManager.query<Array<ShellRow>>(READ_SHELL, [workspaceId, window.from, window.to])
        return toShellFacts(row?.data)
    }
}
