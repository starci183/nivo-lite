import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
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
        const [row] = await callDbFunction<{ shell_data: unknown }>(this.entityManager, "public.shell_data", [
            workspaceId,
            window.from,
            window.to,
        ])
        return toShellFacts(row?.shell_data)
    }
}
