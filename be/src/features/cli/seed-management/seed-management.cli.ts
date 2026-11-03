import { text } from "node:stream/consumers"
import { Command, CommandRunner } from "nest-commander"
import { ManagementSeedService } from "@modules/domain/channel-provisioning"

@Command({
    name: "seed-management",
    description: "Seed the NIVO management workspace from the documents of the stack seed step, read from stdin",
})
/** `cli seed-management`: the data seed command of the stack; its documents arrive on stdin, never in argv or the environment. */
export class SeedManagementCli extends CommandRunner {
    constructor(private readonly seed: ManagementSeedService) {
        super()
    }

    /** Hands the whole of stdin to the seed, which prints what it did and never a value. */
    async run(): Promise<void> {
        await this.seed.run(await text(process.stdin))
    }
}
