import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ContextNote, DismissedNote } from "./context-notes.contracts"
import { ModuleContextNotesError, ModuleContextNotesErrorCode } from "./errors/module-context-notes.error"
import { DISMISS_NOTE, LIST_PENDING_NOTES } from "./persistence/context-notes.sql"

/** Who may read and dismiss a note. */
const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

@Injectable()
/** Notes that supplement an installation's context later: the only owner of module_context_notes. */
export class ContextNotesService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly sessions: SetupSessionsService,
    ) {}

    /** Pending notes of one installation, oldest first; a manager only. */
    async pending(userId: string, workspaceId: string, installationId: string): Promise<ReadonlyArray<ContextNote>> {
        await this.members.require(userId, workspaceId, GOVERNORS)
        return this.entityManager.query<Array<ContextNote>>(LIST_PENDING_NOTES, [workspaceId, installationId])
    }

    /** Dismisses a pending note and takes its fact out of the open draft; a manager only. */
    async dismiss(userId: string, workspaceId: string, noteId: string): Promise<DismissedNote> {
        const member = await this.members.require(userId, workspaceId, GOVERNORS)
        const [row] = await this.entityManager.query<Array<DismissedNote>>(DISMISS_NOTE, [
            workspaceId,
            noteId,
            member.displayName,
            this.clock.now().toISOString(),
        ])
        if (row === undefined) throw new ModuleContextNotesError({ code: ModuleContextNotesErrorCode.NotFound })
        await this.sessions.dropFact(row.installationId, row.factKey)
        return row
    }
}
