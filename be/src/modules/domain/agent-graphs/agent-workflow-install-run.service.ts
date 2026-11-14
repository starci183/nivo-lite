import { Injectable } from "@nestjs/common"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentWorkflowInstallService, type PlannedWorkflow } from "./agent-workflow-install.service"

/** How many workspaces one page of the walk reads; the walk goes on, page after page, until a page comes back short. */
const WORKSPACE_PAGE = 200

/** Where a run prints. */
export interface InstallRunOutput {
    /** Writes one chunk of text. */
    write(text: string): unknown
}

/** What a run is asked. */
export interface InstallRunRequest {
    /** True makes the missing workflows; absent only prints what would be made. */
    readonly execute?: boolean | undefined
    /** Only this workspace; every workspace when absent. */
    readonly workspaceId?: string | undefined
}

/** What a run did. */
export interface InstallRunReport {
    /** True when the run wrote; false for a dry run. */
    readonly executed: boolean
    /** The workspaces walked. */
    readonly workspaces: number
    /** The agents looked at. */
    readonly agents: number
    /** The workflows made (a dry run: the workflows that would be made). */
    readonly added: number
    /** The agents whose install failed; the others were still done. */
    readonly failed: number
}

/** Why a template is left alone, in the words of the table. */
const skipOf = (row: PlannedWorkflow): string =>
    row.action === "waits" ? "primary waits: setup not applied" : `already present (${row.status ?? "unknown"})`

/** One line of the table per template of an agent's module. */
const lineOf = (row: PlannedWorkflow, executed: boolean): string => {
    const name = `${row.templateId} v${row.version}${row.primary ? " (primary)" : ""}`
    if (row.action !== "add") return `    skip   ${name}: ${skipOf(row)}`
    return `    ${executed ? "added " : "add   "} ${name}`
}

@Injectable()
/**
 * Gives every agent of every workspace (or of one) the workflows its plugin ships, where it holds none of them: the repair of the
 * agents installed before the app's doors made them. It is `AgentWorkflowInstallService` and nothing else, agent by agent: the plan
 * is what it prints, the install is what `execute` runs, so the primary template waits where the setup is not applied and the
 * rights follow the workspace's switch exactly as at an install (it agrees nothing). Dry unless told to execute; a second run adds
 * nothing; an agent that fails is printed and counted and the others are still done. Workspaces are read a page at a time
 * (`WORKSPACE_PAGE`), in id order, to the end; a run that was cut short is simply run again, since what was made is then present.
 */
export class AgentWorkflowInstallRunService {
    constructor(
        private readonly workspaces: WorkspacesService,
        private readonly installations: InstallationRecordsService,
        private readonly installer: AgentWorkflowInstallService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Walks the workspaces, prints the table on `out` and answers the counts; one log event per run. */
    async run(out: InstallRunOutput, request: InstallRunRequest): Promise<InstallRunReport> {
        const executed = request.execute === true
        const counts = { workspaces: 0, agents: 0, added: 0, failed: 0 }
        for await (const workspaceId of this.workspaceIds(request.workspaceId)) {
            counts.workspaces += 1
            out.write(`workspace ${workspaceId}\n`)
            for (const installation of await this.installations.list(workspaceId)) {
                const done = await this.agent(out, installation, executed)
                if (done === null) continue
                counts.agents += 1
                counts.added += done.added
                counts.failed += done.failed
            }
        }
        const report: InstallRunReport = { executed, ...counts }
        const verb = executed ? "added" : "to add"
        out.write(
            `install-workflows ${executed ? "executed" : "dry run"}: workspaces ${report.workspaces}, agents ${report.agents}, ${verb} ${report.added}, failed ${report.failed}\n`,
        )
        if (report.added === 0 && report.failed === 0) out.write("nothing to add\n")
        this.logger.info(AgentGraphsLogEvent.WorkflowInstallRun, { ...report })
        return report
    }

    /** One agent: its table, and (when executing) its install. Null for an installation with no agent. A failure is printed. */
    private async agent(
        out: InstallRunOutput,
        installation: InstallationRecord,
        executed: boolean,
    ): Promise<{ readonly added: number; readonly failed: number } | null> {
        const { agentId, workspaceId, moduleKey } = installation
        if (agentId === null) return null
        const input = { workspaceId, agentId, installationId: installation.id, moduleKey }
        const setup = installation.activeContextVersionId === null ? "setup not applied" : "setup applied"
        out.write(`  agent ${agentId} ${moduleKey} (${setup})\n`)
        try {
            const plan = await this.installer.plan(input)
            if (executed) await this.installer.install(input)
            for (const row of plan) out.write(`${lineOf(row, executed)}\n`)
            return { added: plan.filter((row) => row.action === "add").length, failed: 0 }
        } catch (cause: unknown) {
            const code = cause instanceof Error && "code" in cause ? String(cause.code) : "failed"
            out.write(`    FAILED ${code}\n`)
            this.logger.error(AgentGraphsLogEvent.WorkflowInstallFailed, cause, input)
            return { added: 0, failed: 1 }
        }
    }

    /** The workspace named, or every workspace in id order, a page at a time. */
    private async *workspaceIds(only: string | undefined): AsyncGenerator<string> {
        if (only !== undefined) {
            yield only
            return
        }
        let after: string | undefined
        for (;;) {
            const page = await this.workspaces.list(WORKSPACE_PAGE, after)
            for (const workspace of page) yield workspace.id
            after = page.at(-1)?.id
            if (page.length < WORKSPACE_PAGE || after === undefined) return
        }
    }
}
