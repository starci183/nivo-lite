import { Injectable, Optional } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectOpenclawGatewayAdmin } from "@modules/integrations/openclaw"
import type { GatewayAdminClient } from "@modules/integrations/openclaw"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { WorkspacesError, WorkspacesErrorCode } from "./errors/workspaces.error"
import { WorkspaceEntity } from "./persistence/entities"
import { CONFIRMATION_WORD, NIVO_WORKSPACE_ID } from "./workspaces.contracts"
import type { PruneConsole, PruneReport, PruneRequest, WorkspaceBrief } from "./workspaces.contracts"

const NO_PLAN = "no plan"

/** The most workspaces one prune reads. */
const WORKSPACES_MAX = 1000

@Injectable()
/**
 * Deletes every workspace except the kept ones, with everything that hangs off them (the schema cascades; platform_audit and
 * app_errors keep their rows with the workspace link cleared) and its OpenClaw agents with their sessions and files, which go first
 * so a workspace whose agents could not be removed stays and a rerun retries it. Sign-in accounts are not deleted. It lists first and deletes only
 * after the operator types the confirmation word. Permanent: there is no undo.
 */
export class WorkspacePruneService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @Optional() @InjectOpenclawGatewayAdmin() private readonly openclaw: GatewayAdminClient | null = null,
    ) {}

    /** Lists what is kept and what goes, asks for the confirmation, then deletes workspace by workspace. */
    async prune(request: PruneRequest, terminal: PruneConsole): Promise<PruneReport> {
        const keep = new Set([...(request.default === false ? [] : [NIVO_WORKSPACE_ID]), ...(request.keep ?? [])])
        if (keep.size === 0) throw new WorkspacesError({ code: WorkspacesErrorCode.NothingToKeep })
        const stored = await this.entityManager.find(WorkspaceEntity, {
            select: { id: true, name: true, planCode: true, status: true },
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
        terminal.print(`DELETE (${doomed.length}):`)
        for (const workspace of doomed) {
            terminal.print(
                `  ${workspace.name}  (${workspace.plan_code ?? NO_PLAN}, ${workspace.status})  ${workspace.id}`,
            )
        }
        if (doomed.length === 0) {
            terminal.print("Nothing to delete.")
            return { status: "nothing-to-delete", kept, doomed, left: all.length }
        }
        const openclaw = this.openclaw
        if (openclaw?.enabled !== true) {
            terminal.print(
                "Refused: no OpenClaw gateway is configured here, so these workspaces' agents cannot be removed. Nothing was deleted. Run this where OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN are set (production: inside the nivo-api task).",
            )
            throw new WorkspacesError({ code: WorkspacesErrorCode.OpenclawUnavailable })
        }
        if (request.yes !== true) {
            const answer = await terminal.ask(
                `Type ${CONFIRMATION_WORD} to permanently delete these ${doomed.length} workspaces: `,
            )
            if (answer.trim() !== CONFIRMATION_WORD) {
                terminal.print("Cancelled. Nothing deleted.")
                return { status: "cancelled", kept, doomed, left: all.length }
            }
        }
        const failed = await this.remove(doomed, openclaw, terminal)
        const left = await this.entityManager.count(WorkspaceEntity)
        terminal.print(`Done. ${doomed.length - failed} deleted, ${failed} failed, ${left} workspace(s) left.`)
        if (failed > 0) {
            throw new WorkspacesError({ code: WorkspacesErrorCode.DeleteFailed, params: { failed } })
        }
        return { status: "deleted", kept, doomed, left }
    }

    /** Deletes the workspaces one by one so a failure leaves the others deleted; answers how many failed. */
    private async remove(
        doomed: ReadonlyArray<WorkspaceBrief>,
        openclaw: GatewayAdminClient,
        terminal: PruneConsole,
    ): Promise<number> {
        let failed = 0
        await eachInOrder(doomed, (workspace) =>
            this.removeAgents(workspace, openclaw, terminal)
                .then(() => this.entityManager.delete(WorkspaceEntity, { id: workspace.id }))
                .then(
                    () => terminal.print(`  deleted ${workspace.name}`),
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

    /** Removes the workspace's OpenClaw agents, retired ones included, with their sessions and files. */
    private async removeAgents(
        workspace: WorkspaceBrief,
        openclaw: GatewayAdminClient,
        terminal: PruneConsole,
    ): Promise<void> {
        const removed = await openclaw.removeWorkspaceAgents(workspace.id)
        terminal.print(`  removed ${removed.length} OpenClaw agent(s) of ${workspace.name}`)
    }
}
