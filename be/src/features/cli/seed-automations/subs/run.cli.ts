import { CommandRunner, SubCommand } from "nest-commander"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"

@SubCommand({ name: "run", description: "Write the automation catalogue of the code into the database" })
/** `cli seed-automations run`: validates every template definition and upserts the catalogue in one transaction. */
export class RunSeedAutomationsCli extends CommandRunner {
    constructor(private readonly templates: AutomationTemplatesService) {
        super()
    }

    /** Syncs the catalogue from the template constants. */
    async run(): Promise<void> {
        await this.templates.syncFromCatalog()
    }
}
