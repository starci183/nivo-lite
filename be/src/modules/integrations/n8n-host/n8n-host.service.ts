import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { N8nHostError, N8nHostErrorCode } from "./errors/n8n-host.error"
import type { N8nHost, N8nHostShell, N8nSyncOptions, N8nSyncStep } from "./n8n-host.contracts"
import { InjectN8nHostOptions, InjectN8nHostShell } from "./n8n-host.decorators"
import { N8nHostLogEvent } from "./n8n-host.log-events"
import type { N8nHostOptions } from "./n8n-host.options"
import { idsByName, importDocument, workflowsOf } from "./n8n-host.policy"

/** A private, atomically allocated container directory prevents shared-host symlink races; the trap cleans up failed imports too. */
const IMPORT_COMMAND = [
    "umask 077",
    "directory=$(mktemp -d) || exit 1",
    "trap 'rm -rf -- \"$directory\"' EXIT",
    'cat > "$directory/workflows.json" && n8n import:workflow --input="$directory/workflows.json"',
].join("; ")

@Injectable()
/**
 * Puts the shared workflow files into the n8n container of the host: one import carrying the id of the workflow of the same name, so
 * a re-run replaces instead of adding a copy; then each is activated and n8n restarts once so its webhooks register.
 */
export class N8nHostService implements N8nHost {
    constructor(
        @InjectN8nHostShell() private readonly shell: N8nHostShell,
        @InjectN8nHostOptions() private readonly options: N8nHostOptions,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Answers the steps taken, or planned under `dryRun`, and logs them. */
    async sync(options: N8nSyncOptions): Promise<ReadonlyArray<N8nSyncStep>> {
        const steps = await this.run(workflowsOf(await this.shell.workflows()), options)
        this.logger.info(N8nHostLogEvent.WorkflowsSynced, { dryRun: options.dryRun, steps })
        return steps
    }

    private async run(
        workflows: ReturnType<typeof workflowsOf>,
        options: N8nSyncOptions,
    ): Promise<ReadonlyArray<N8nSyncStep>> {
        const container = this.options.container
        const host = (command: string, input = ""): Promise<string> =>
            this.shell.run({ command, input, local: options.local })
        const listing = async (): Promise<ReadonlyMap<string, string>> =>
            idsByName(await host(`docker exec ${container} n8n list:workflow`))
        const existing = await listing()
        const plan = workflows.map((workflow) => ({ workflow, id: existing.get(workflow.name) ?? "" }))
        const planned = plan.map(({ workflow, id }): N8nSyncStep => ({
            action: id ? "update" : "create",
            name: workflow.name,
            id,
        }))
        if (options.dryRun) return planned
        await host(
            `docker exec -i ${container} sh -c '${IMPORT_COMMAND.replaceAll("'", String.raw`'\''`)}'`,
            importDocument(plan),
        )
        const imported = await listing()
        const activated: Array<N8nSyncStep> = []
        await eachInOrder(plan, async ({ workflow }) => {
            const id = imported.get(workflow.name)
            if (id === undefined) throw new N8nHostError({ code: N8nHostErrorCode.WorkflowMissing })
            await host(`docker exec ${container} n8n update:workflow --id=${id} --active=true`)
            activated.push({ action: "active", name: workflow.name, id })
        })
        if (!options.restart) return [...planned, ...activated]
        await host(`docker restart ${container}`)
        return [...planned, ...activated, { action: "restart", name: "", id: "" }]
    }
}
