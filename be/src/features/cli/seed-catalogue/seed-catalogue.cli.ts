import { text } from "node:stream/consumers"
import { Command, CommandRunner, Option } from "nest-commander"
import { CatalogueSeedService } from "@modules/domain/channel-provisioning"

/** What `seed-catalogue` is asked to do, as the command line parsed it. */
export interface SeedCatalogueCommand {
    /** The name of the workspace whose catalogue is seeded. */
    readonly workspace?: string
}

@Command({
    name: "seed-catalogue",
    description: "Seed the catalogue of a named workspace from the documents of the stack seed step, read from stdin",
})
/** `cli seed-catalogue --workspace <name>`: the data seed command of the stack; its documents arrive on stdin, never in argv or the environment. */
export class SeedCatalogueCli extends CommandRunner {
    constructor(private readonly seed: CatalogueSeedService) {
        super()
    }

    /** Hands the whole of stdin and the workspace name to the seed, which prints what it did and never a value. */
    async run(_params: Array<string>, options: SeedCatalogueCommand): Promise<void> {
        await this.seed.run(await text(process.stdin), options.workspace ?? "")
    }

    /** The workspace name. */
    @Option({ flags: "-w, --workspace <name>", description: "The name of the workspace whose catalogue is seeded" })
    parseWorkspace(value: string): string {
        return value
    }
}
