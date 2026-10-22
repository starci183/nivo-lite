import { CommandRunner, Option, SubCommand } from "nest-commander"
import { OfficeSeedService } from "@modules/domain/workspace-seed"
import type { OfficeCommand } from "@modules/domain/workspace-seed"

@SubCommand({
    name: "office",
    description:
        "Seed the v0.3.2 story (five people, department rooms, four agents with their owners and tag lists) into the UAT workspace; dry run without --execute",
})
/** `cli seed-workspace office --owner <email> [--execute]`, with the private ensure input and office input of the target runner. */
export class OfficeSeedWorkspaceCli extends CommandRunner {
    constructor(private readonly office: OfficeSeedService) {
        super()
    }

    /** Runs the office seed once with the parsed options; the service prints the public receipt. */
    async run(...[, options]: [Array<string>, OfficeCommand]): Promise<void> {
        await this.office.officeOperator(options)
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
