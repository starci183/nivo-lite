import { CommandRunner, Option, SubCommand } from "nest-commander"
import { WorkspaceProfileService } from "@modules/domain/workspace-seed"

/** The options of the profile command. */
interface ProfileOptions {
    /** The profile key. */
    readonly profile?: string
    /** The owner email the private input must hold. */
    readonly owner?: string
    /** Writes when true; a dry run otherwise. */
    readonly execute?: boolean
}

@SubCommand({
    name: "profile",
    description:
        "Apply a named workspace profile (brand, agents, grants, documents, Hub rooms) after ensuring the workspace; dry run without --execute",
})
/** `cli seed-workspace profile --profile hakuen --owner <email> [--execute]`, with the private ensure input of the target runner. */
export class ProfileSeedWorkspaceCli extends CommandRunner {
    constructor(private readonly profiles: WorkspaceProfileService) {
        super()
    }

    /** Runs the profile once; the service prints the public receipt. */
    async run(_params: Array<string>, options: ProfileOptions): Promise<void> {
        await this.profiles.profileOperator({
            profile: options.profile ?? "",
            owner: options.owner ?? "",
            execute: options.execute === true,
        })
    }

    /** The profile key. */
    @Option({ flags: "-p, --profile <key>", description: "The workspace profile to apply, e.g. hakuen" })
    parseProfile(value: string): string {
        return value
    }

    /** The owner email. */
    @Option({ flags: "-o, --owner <email>", description: "The owner email the private input must name" })
    parseOwner(value: string): string {
        return value
    }

    /** Writes instead of a dry run. */
    @Option({ flags: "--execute", description: "Write; without it the command only validates and prints the plan" })
    parseExecute(): boolean {
        return true
    }
}
