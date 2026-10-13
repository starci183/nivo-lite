import { CommandRunner, SubCommand } from "nest-commander"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"

@SubCommand({ name: "run", description: "Write the automation catalogue of the resources folder into the database" })
/** `cli seed-automations run`: validates every definition file and upserts the catalogue in one transaction. */
export class RunSeedAutomationsCli extends CommandRunner {
    constructor(private readonly templates: AutomationTemplatesService) {
        super()
    }

    /** Syncs the catalogue from the definition files. */
    async run(): Promise<void> {
        await this.templates.syncFromFiles()
    }
}
