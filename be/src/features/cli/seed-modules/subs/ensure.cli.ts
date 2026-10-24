import { CommandRunner, SubCommand } from "nest-commander"
import { ModulesService } from "@modules/domain/modules"

@SubCommand({
    name: "ensure",
    description: "Sync the catalogue, then fail when a default rule names an action the database lacks",
})
/** `cli seed-modules ensure`: the deploy's catalogue check; delegates to the modules, which print the verdict or fail. */
export class EnsureSeedModulesCli extends CommandRunner {
    constructor(private readonly modules: ModulesService) {
        super()
    }

    /** Hands the output to the modules without changing it. */
    async run(): Promise<void> {
        await this.modules.ensure(process.stdout)
    }
}
