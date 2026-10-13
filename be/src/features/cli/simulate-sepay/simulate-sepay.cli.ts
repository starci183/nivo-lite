import { Command, CommandRunner } from "nest-commander"
import { RunSimulateSepayCli } from "./subs/run.cli"

@Command({
    name: "simulate-sepay",
    description: "Development tool: post a realistic SePay bank webhook to a running api",
    subCommands: [RunSimulateSepayCli],
})
/** `cli simulate-sepay`: the SePay simulation group; its commands are the sub-commands (`cli simulate-sepay run`). */
export class SimulateSepayCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
