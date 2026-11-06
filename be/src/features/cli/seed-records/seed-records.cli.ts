import { text } from "node:stream/consumers"
import { Command, CommandRunner, Option } from "nest-commander"
import { RecordsSeedService } from "@modules/domain/channel-provisioning"

/** What `seed-records` is asked to do, as the command line parsed it. */
export interface SeedRecordsCommand {
    /** The name of the workspace whose records are seeded. */
    readonly workspace: string
}

@Command({
    name: "seed-records",
    description:
        "Seed records of a named workspace through the entity engine, from the documents of the stack seed step, read from stdin",
})
/** `cli seed-records --workspace <name>`: the data seed command of the stack; its documents arrive on stdin, never in argv or the environment. */
export class SeedRecordsCli extends CommandRunner {
    constructor(private readonly seed: RecordsSeedService) {
        super()
    }

    /** Hands the whole of stdin and the workspace name to the seed, which prints what it did and never a value. */
    async run(_params: Array<string>, options: SeedRecordsCommand): Promise<void> {
        await this.seed.run(await text(process.stdin), options.workspace)
    }

    /** The workspace name; none given is the empty name, which the seed refuses. */
    @Option({
        flags: "-w, --workspace <name>",
        description: "The name of the workspace whose records are seeded",
        defaultValue: "",
    })
    parseWorkspace(value: string): string {
        return value
    }
}
