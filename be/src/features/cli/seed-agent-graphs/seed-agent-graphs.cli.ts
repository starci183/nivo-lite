import { text } from "node:stream/consumers"
import { Command, CommandRunner, Option } from "nest-commander"
import { GraphSeedService } from "@modules/domain/workspace-seed"

/** What `seed-agent-graphs` is asked to do, as the command line parsed it. */
export interface SeedAgentGraphsCommand {
    /** The name of the workspace whose agents run the graphs. */
    readonly workspace?: string
}

@Command({
    name: "seed-agent-graphs",
    description: "Seed the agent graphs of the documents of the stack seed step, read from stdin, into a named workspace",
})
/** `cli seed-agent-graphs --workspace <name>`: the data seed command of the stack; its documents arrive on stdin, never in argv or the environment. */
export class SeedAgentGraphsCli extends CommandRunner {
    constructor(private readonly seed: GraphSeedService) {
        super()
    }

    /** Hands the whole of stdin and the workspace name to the seed, which prints what it did and never a value. */
    async run(_params: Array<string>, options: SeedAgentGraphsCommand): Promise<void> {
        await this.seed.run(await text(process.stdin), options.workspace ?? "")
    }

    /** The workspace name. */
    @Option({ flags: "-w, --workspace <name>", description: "The name of the workspace whose agents run the graphs" })
    parseWorkspace(value: string): string {
        return value
    }
}
