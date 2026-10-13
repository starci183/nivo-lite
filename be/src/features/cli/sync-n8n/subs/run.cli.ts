import { CommandRunner, Option, SubCommand } from "nest-commander"
import { InjectN8nHost } from "@modules/integrations/n8n-host"
import type { N8nHost, N8nSyncOptions } from "@modules/integrations/n8n-host"

@SubCommand({
    name: "run",
    description: "Import the shared workflows into the n8n container, activate them and restart n8n",
})
/** `cli sync-n8n run`: upserts each workflow by name, activates it and restarts n8n once. */
export class RunSyncN8nCli extends CommandRunner {
    constructor(@InjectN8nHost() private readonly host: N8nHost) {
        super()
    }

    /** Syncs the workflows with the options the command line carries; commander fills every one of them. */
    async run(_passed: Array<string>, options: N8nSyncOptions): Promise<void> {
        await this.host.sync(options)
    }

    /** Dry run: show the plan and change nothing. */
    @Option({ flags: "--dry-run", description: "Show what would change", defaultValue: false })
    parseDryRun(): boolean {
        return true
    }

    /** Local: use the docker container of this machine. */
    @Option({ flags: "--local", description: "Talk to a local docker container", defaultValue: false })
    parseLocal(): boolean {
        return true
    }

    /** Restart: on by default, `--no-restart` turns it off. */
    @Option({ flags: "--no-restart", description: "Skip the restart of n8n", defaultValue: true })
    parseRestart(): boolean {
        return false
    }
}
