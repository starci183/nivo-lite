import { text } from "node:stream/consumers"
import { Command, CommandRunner, Option } from "nest-commander"
import { BrainSeedService } from "@modules/domain/channel-provisioning"

/** What `seed-brain` is asked to do, as the command line parsed it. */
export interface SeedBrainCommand {
    /** The name of the workspace whose Brain documents are seeded. */
    readonly workspace: string
}

@Command({
    name: "seed-brain",
    description:
        "Seed the Brain documents of a named workspace from the documents of the stack seed step, read from stdin",
})
/** `cli seed-brain --workspace <name>`: the data seed command of the stack; its documents arrive on stdin, never in argv or the environment. */
export class SeedBrainCli extends CommandRunner {
    constructor(private readonly seed: BrainSeedService) {
        super()
    }

    /** Hands the whole of stdin and the workspace name to the seed, which prints what it did and never a value. */
    async run(_params: Array<string>, options: SeedBrainCommand): Promise<void> {
        await this.seed.run(await text(process.stdin), options.workspace)
    }

    /** The workspace name; none given is the empty name, which the seed refuses. */
    @Option({
        flags: "-w, --workspace <name>",
        description: "The name of the workspace whose Brain documents are seeded",
        defaultValue: "",
    })
    parseWorkspace(value: string): string {
        return value
    }
}
