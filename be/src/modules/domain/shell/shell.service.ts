import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ShellRow } from "./persistence/shell.rows"
import { READ_SHELL } from "./persistence/shell.sql"
import type { ShellFacts, ShellWindow } from "./shell.contracts"
import { toShellFacts } from "./shell.mapper"

@Injectable()
/** The facts the console frame draws, read in one request for an active member of the workspace. */
export class ShellService {
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
