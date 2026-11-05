import { CommandRunner, Option, SubCommand } from "nest-commander"
import { EntityPlannerService } from "@modules/domain/entity-planner"
import type { EntityPlanOptions } from "@modules/domain/entity-planner"

@SubCommand({
    name: "plan",
    description: "Print the plan from the declarations to the database; --write adds the migration",
})
/** `cli entities plan [--write] [--contract]`: delegates the diff, the migration file and the manifest to the entity planner. */
export class PlanCli extends CommandRunner {
    constructor(private readonly planner: EntityPlannerService) {
        super()
    }

    /** Plans once; a destructive plan fails unless `--contract` is given. */
    async run(_passedParams: Array<string>, options: EntityPlanOptions): Promise<void> {
        await this.planner.plan(options, process.stdout)
    }

    /** Write the next migration file and `db/entities.manifest.json`. */
    @Option({ flags: "--write", description: "Write the migration and the entities manifest" })
    parseWrite(): true {
        return true
    }

    /** Allow dropping and narrowing steps; the file is named `*_contract_*`. */
    @Option({ flags: "--contract", description: "Allow steps that drop or narrow; writes a *_contract_* migration" })
    parseContract(): true {
        return true
    }
}
