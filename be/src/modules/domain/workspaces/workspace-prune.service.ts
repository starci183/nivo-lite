import { Injectable } from "@nestjs/common"
import { IsNull, type EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import {
    CONFIRMATION_WORD,
    NIVO_WORKSPACE_ID,
    type PruneConsole,
    type PruneReport,
    type PruneRequest,
    type WorkspaceBrief,
} from "./workspaces.contracts"

const NO_PLAN = "no plan"

/** The most workspaces one prune reads. */
const WORKSPACES_MAX = 1000

@Injectable()
/**
 * Deletes every workspace except the kept ones, SOFTLY (owner ruling R36): each gets the same deleted mark the owner's own delete writes
 * (`workspaces.deleted_at`), and nothing else is removed: its agents, runs, conversations, contacts, customer messages and memory stay in
 * the database and every read leaves the workspace out (nothing cascades; the schema's foreign keys are NO ACTION and the application role
 * has no DELETE on `workspaces`). Sign-in accounts are not deleted. It lists first and marks only after the operator types the
 * confirmation word. A workspace already deleted is not listed again.
 */
export class WorkspacePruneService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Lists what is kept and what goes, asks for the confirmation, then deletes workspace by workspace. */
    async prune(request: PruneRequest, terminal: PruneConsole): Promise<PruneReport> {
        const keep = new Set([...(request.default === false ? [] : [NIVO_WORKSPACE_ID]), ...(request.keep ?? [])])
        if (keep.size === 0) throw new WorkspacesError({ code: WorkspacesErrorCode.NothingToKeep })
        const stored = await this.entityManager.find(WorkspaceEntity, {
            select: { id: true, name: true, planCode: true, status: true },
            where: { deletedAt: IsNull() },
            order: { createdAt: "ASC" },
            take: WORKSPACES_MAX,
        })
        const all: ReadonlyArray<WorkspaceBrief> = stored.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            plan_code: workspace.planCode,
            status: workspace.status,
        }))
        const kept = all.filter((workspace) => keep.has(workspace.id))
        const doomed = all.filter((workspace) => !keep.has(workspace.id))
        terminal.print("KEEP:")
        for (const workspace of kept)
            terminal.print(`  ${workspace.name}  (${workspace.plan_code ?? NO_PLAN})  ${workspace.id}`)
        if (kept.length !== keep.size) throw new WorkspacesError({ code: WorkspacesErrorCode.KeepNotFound })
        terminal.print(`DELETE, softly (${doomed.length}):`)
        for (const workspace of doomed) {
            terminal.print(
                `  ${workspace.name}  (${workspace.plan_code ?? NO_PLAN}, ${workspace.status})  ${workspace.id}`,
            )
        }
        if (doomed.length === 0) {
            terminal.print("Nothing to delete.")
            return { status: "nothing-to-delete", kept, doomed, left: all.length }
        }
        if (request.yes !== true) {
            const answer = await terminal.ask(
                `Type ${CONFIRMATION_WORD} to delete these ${doomed.length} workspaces (soft delete: nothing is removed, every read hides them): `,
            )
            if (answer.trim() !== CONFIRMATION_WORD) {
                terminal.print("Cancelled. Nothing deleted.")
                return { status: "cancelled", kept, doomed, left: all.length }
            }
        }
        const failed = await this.remove(doomed, terminal)
        const left = await this.entityManager.count(WorkspaceEntity, { where: { deletedAt: IsNull() } })
        terminal.print(`Done. ${doomed.length - failed} deleted, ${failed} failed, ${left} workspace(s) left.`)
        if (failed > 0) {
            throw new WorkspacesError({ code: WorkspacesErrorCode.DeleteFailed, params: { failed } })
        }
        return { status: "deleted", kept, doomed, left }
    }

    /** Marks the workspaces deleted one by one so a failure leaves the others marked; answers how many failed. */
    private async remove(doomed: ReadonlyArray<WorkspaceBrief>, terminal: PruneConsole): Promise<number> {
        let failed = 0
        await eachInOrder(doomed, (workspace) =>
            this.entityManager
                .update(WorkspaceEntity, { id: workspace.id, deletedAt: IsNull() }, { deletedAt: this.clock.now() })
                .then(
                    () => terminal.print(`  deleted (soft) ${workspace.name}`),
                    (cause: unknown) => {
                        failed += 1
                        terminal.print(
                            `  FAILED ${workspace.name}: ${cause instanceof Error ? cause.message : String(cause)}`,
                        )
                    },
                ),
        )
        return failed
    }
}
