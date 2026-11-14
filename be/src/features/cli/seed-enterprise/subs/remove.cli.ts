import { text } from "node:stream/consumers"
import { CommandRunner, Option, SubCommand } from "nest-commander"
import { EnterpriseSeedService } from "@modules/domain/channel-provisioning"

/** What `seed-enterprise remove` is asked to do, as the command line parsed it. */
export interface SeedEnterpriseRemoveCommand {
    /** The stack environment, as `application-stacks.yaml` names it; production is refused. */
    readonly env: string
    /** Whether to remove; without it the command prints the plan and removes nothing. */
    readonly execute: boolean
}

@SubCommand({
    name: "remove",
    description:
        "Take the enterprises of the documents on stdin off the local stack, with everything made there while testing, through the owner's delete door; dry by default (prints what goes), --execute removes; refused in production and while a target still includes the environment; never run by the seed step",
})
/** `cli seed-enterprise remove --env dev [--execute] < <enterprise document>`: run by hand, never by the stack. */
export class EnterpriseRemoveCli extends CommandRunner {
    constructor(private readonly seed: EnterpriseSeedService) {
        super()
    }

    /** Hands the whole of stdin, the environment and the execute choice to the seed, which prints the plan and what it removed. */
    async run(_params: Array<string>, options: SeedEnterpriseRemoveCommand): Promise<void> {
        await this.seed.remove(await text(process.stdin), options.env, options.execute)
    }

    /** The environment; none given is the empty name, which the seed refuses. */
    @Option({
        flags: "--env <name>",
        description: "The stack environment: dev (production is refused)",
        defaultValue: "",
    })
    parseEnv(value: string): string {
        return value
    }

    /** Removes instead of printing the plan. */
    @Option({ flags: "--execute", description: "Remove; without it nothing is removed", defaultValue: false })
    parseExecute(): boolean {
        return true
    }
}
