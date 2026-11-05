import { Command, CommandRunner } from "nest-commander"
import { CheckCli } from "./subs/check.cli"
import { PlanCli } from "./subs/plan.cli"

@Command({
    name: "entities",
    description: "The entity partitions of the records model",
    subCommands: [PlanCli, CheckCli],
})
/** `cli entities`: the entity planner group; its commands are the sub-commands (`cli entities plan`). */
export class EntitySchemaCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
