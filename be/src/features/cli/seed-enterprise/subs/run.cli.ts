import { text } from "node:stream/consumers"
import { CommandRunner, Option, SubCommand } from "nest-commander"
import { EnterpriseSeedService } from "@modules/domain/channel-provisioning"

/** What `seed-enterprise run` is asked to do, as the command line parsed it. */
export interface SeedEnterpriseRunCommand {
    /** The stack environment the seed runs in, as `application-stacks.yaml` names it (`dev`, `production`). */
    readonly env: string
}

@SubCommand({
    name: "run",
    description:
        "Seed the foundation of every enterprise whose target includes this environment (dev is local, production is prod), from the documents of the stack seed step on stdin; an enterprise whose target leaves the environment out is not touched",
})
/** `cli seed-enterprise run --env <env>`: the data seed command of the stack; its documents arrive on stdin, never in argv or the environment. */
export class EnterpriseRunCli extends CommandRunner {
    constructor(private readonly seed: EnterpriseSeedService) {
        super()
    }

    /** Hands the whole of stdin and the environment to the seed, which prints what it did, ending with `unchanged` when nothing changed. */
    async run(_params: Array<string>, options: SeedEnterpriseRunCommand): Promise<void> {
        await this.seed.run(await text(process.stdin), options.env)
    }

    /** The environment; none given is the empty name, which the seed refuses. */
    @Option({ flags: "--env <name>", description: "The stack environment: dev or production", defaultValue: "" })
    parseEnv(value: string): string {
        return value
    }
}
