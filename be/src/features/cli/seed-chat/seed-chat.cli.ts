import { text } from "node:stream/consumers"
import { Command, CommandRunner, Option } from "nest-commander"
import { ChatSeedService } from "@modules/domain/channel-provisioning"

/** What `seed-chat` is asked to do, as the command line parsed it. */
export interface SeedChatCommand {
    /** The name of the workspace whose chat is seeded. */
    readonly workspace: string
}

@Command({
    name: "seed-chat",
    description:
        "Seed the group rooms and lines of the team chat of a named workspace, from the documents of the stack seed step, read from stdin",
})
/** `cli seed-chat --workspace <name>`: the data seed command of the stack; its documents arrive on stdin, never in argv or the environment. */
export class SeedChatCli extends CommandRunner {
    constructor(private readonly seed: ChatSeedService) {
        super()
    }

    /** Hands the whole of stdin and the workspace name to the seed, which prints what it did and never a value. */
    async run(_params: Array<string>, options: SeedChatCommand): Promise<void> {
        await this.seed.run(await text(process.stdin), options.workspace)
    }

    /** The workspace name; none given is the empty name, which the seed refuses. */
    @Option({
        flags: "-w, --workspace <name>",
        description: "The name of the workspace whose chat is seeded",
        defaultValue: "",
    })
    parseWorkspace(value: string): string {
        return value
    }
}
