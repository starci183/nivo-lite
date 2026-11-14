import { CommandRunner, Option, SubCommand } from "nest-commander"
import { BrainPolicyDerivationsService } from "@modules/domain/brain"

/** What `backfill` reads from its flags. */
export interface BackfillBrainPoliciesOptions {
    /** The most workspaces to queue in this run, as typed (the service reads it and bounds it to its own maximum). */
    readonly limit?: string
}

@SubCommand({
    name: "backfill",
    description:
        "Queue one policy derive pass for every workspace with facts in force and no derive state yet (idempotent; queues only, the api's knowledge worker runs the passes and each pass is a model call)",
})
/** `cli brain-policies backfill [--limit <n>]`: hands the flag and stdout to the policy derivations, which queue the passes and print how many. */
export class BackfillBrainPoliciesCli extends CommandRunner {
    constructor(private readonly derivations: BrainPolicyDerivationsService) {
        super()
    }

    /** Queues the passes; the derivations print the count on stdout. */
    async run(_passedParams: Array<string>, options: BackfillBrainPoliciesOptions = {}): Promise<void> {
        await this.derivations.backfillFor(process.stdout, options.limit)
    }

    /** The most workspaces to queue. */
    @Option({
        flags: "--limit <workspaces>",
        description: "The most workspaces to queue in this run (default and maximum 200)",
    })
    parseLimit(value: string): string {
        return value
    }
}
