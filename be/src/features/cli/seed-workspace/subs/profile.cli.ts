import { CommandRunner, Option, SubCommand } from "nest-commander"
import { WorkspaceProfileService } from "@modules/domain/workspace-seed"
import type { ProfileCommand } from "@modules/domain/workspace-seed"

@SubCommand({
    name: "profile",
    description:
        "Apply a named workspace profile (brand, agents, grants, documents, Hub rooms) after ensuring the workspace; dry run without --execute",
})
/** `cli seed-workspace profile --profile <key> --owner <email> [--execute]`, with the private ensure input of the target runner. */
export class ProfileSeedWorkspaceCli extends CommandRunner {
    constructor(private readonly profiles: WorkspaceProfileService) {
        super()
    }

    /** Runs the profile once with the parsed options; the service prints the public receipt. */
    async run(_params: Array<string>, options: ProfileCommand): Promise<void> {
        await this.profiles.profileOperator(options)
    }

    /** The profile key. */
    @Option({ flags: "-p, --profile <key>", description: "The key of the workspace profile to apply" })
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
