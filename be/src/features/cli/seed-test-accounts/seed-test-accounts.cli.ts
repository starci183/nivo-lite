import { text } from "node:stream/consumers"
import { Command, CommandRunner } from "nest-commander"
import { TestAccountsSeedService } from "@modules/domain/channel-provisioning"

@Command({
    name: "seed-test-accounts",
    description: "Seed the test seats of the workspaces from the documents of the stack seed step, read from stdin",
})
/** `cli seed-test-accounts`: the data seed command of the stack; its documents arrive on stdin, never in argv or the environment. */
export class SeedTestAccountsCli extends CommandRunner {
    constructor(private readonly seed: TestAccountsSeedService) {
        super()
    }

    /** Hands the whole of stdin to the seed, which prints what it did and never a value. */
    async run(): Promise<void> {
        await this.seed.run(await text(process.stdin))
    }
}
