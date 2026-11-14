import { Command, CommandRunner } from "nest-commander"
import { BackfillBrainPoliciesCli } from "./subs/backfill.cli"

@Command({
    name: "brain-policies",
    description: "Operate the policies the AI derives from each workspace's truth graph",
    subCommands: [BackfillBrainPoliciesCli],
})
/** `cli brain-policies`: the group; its command is the sub-command (`cli brain-policies backfill`). */
export class BrainPoliciesCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
