import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { SetupSessionsService } from "@modules/domain/module-setup-sessions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import type { ContextNote, DismissedNote } from "./context-notes.contracts"
import { ModuleContextNotesError, ModuleContextNotesErrorCode } from "./errors/module-context-notes.error"
import { ModuleContextNoteEntity } from "./persistence/entities"

/** How many pending notes of one installation are read at once. */
const PENDING_NOTES_LIMIT = 200

/** Who may read and dismiss a note. */
const GOVERNORS: ReadonlyArray<WorkspaceRole> = ["owner", "manager"]

/** The columns the dismissing update answers. */
interface DismissedRow {
    /** The installation whose draft holds the fact. */
    readonly installation_id: string
    /** The fact key the note added to the draft. */
    readonly fact_key: string
}

const isDismissedRow = (value: unknown): value is DismissedRow =>
    isRecord(value) && typeof value.installation_id === "string" && typeof value.fact_key === "string"

/** The first row the dismissing update answered; the answer is a list of rows, anything else holds none. */
const dismissedRowOf = (raw: unknown): DismissedRow | undefined => [raw].flat().find(isDismissedRow)

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
        const notes = await this.entityManager.find(ModuleContextNoteEntity, {
            where: { workspaceId, installationId, status: "pending" },
            order: { createdAt: "ASC" },
            take: PENDING_NOTES_LIMIT,
        })
        return notes.map((note) => ({
            id: note.id,
            installationId: note.installationId,
            body: note.body,
            source: note.source,
            authorName: note.authorName,
            authorRole: note.authorRole,
            status: note.status,
            createdAt: note.createdAt.toISOString(),
        }))
    }

    /** Dismisses a pending note and takes its fact out of the open draft; a manager only. */
    async dismiss(userId: string, workspaceId: string, noteId: string): Promise<DismissedNote> {
        const member = await this.members.require(userId, workspaceId, GOVERNORS)
        const changed = await this.entityManager
            .createQueryBuilder(ModuleContextNoteEntity, "m")
            .update()
            .set({ status: "dismissed", decidedBy: member.displayName, decidedAt: this.clock.now() })
            .where({ workspaceId, id: noteId, status: "pending" })
            .returning(["installationId", "factKey"])
            .execute()
        const row = dismissedRowOf(changed.raw)
        if (row === undefined) throw new ModuleContextNotesError({ code: ModuleContextNotesErrorCode.NotFound })
        const dismissed: DismissedNote = { installationId: row.installation_id, factKey: row.fact_key }
        await this.sessions.dropFact(dismissed.installationId, dismissed.factKey)
        return dismissed
    }
}
