import { Command, CommandRunner } from "nest-commander"
import { EnterpriseRemoveCli } from "./subs/remove.cli"
import { EnterpriseRunCli } from "./subs/run.cli"

@Command({
    name: "seed-enterprise",
    description:
        "The foundation of the enterprise workspaces (one document per enterprise, nivo-web first: its workspace, identifier and target local | prod | both | off). Foundation only: usage data such as the CRM import of customer files has its own command and is never seeded. Moving an enterprise from local to prod = set its target to prod, the stack seeds the same foundation there and its imports run there again; nothing made locally travels; then `remove` takes it off the local stack.",
    subCommands: [EnterpriseRunCli, EnterpriseRemoveCli],
})
/** `cli seed-enterprise`: the seed-enterprise group; its commands are `run` (the stack seed step) and `remove` (by hand). */
export class SeedEnterpriseCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
