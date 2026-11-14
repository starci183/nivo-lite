import { CommandRunner, Option, SubCommand } from "nest-commander"
import { AccountDataPlanService } from "@modules/domain/account-data"

@SubCommand({
    name: "plan",
    description:
        "Print the DDL-free plan of the declared account data types as JSON (partitions, CHECKs, indexes); no database. `npm run account-data:ddl` renders it into the migration",
})
/** `cli account-data plan --json`: hands stdout to the account-data planner. */
export class PlanAccountDataCli extends CommandRunner {
    constructor(private readonly planner: AccountDataPlanService) {
        super()
    }

    /** Prints the plan as JSON. */
    run(): Promise<void> {
        return this.planner.print(process.stdout)
    }

    /** Print JSON (the only form the plan has). */
    @Option({ flags: "--json", description: "Print the plan as JSON (the default and only form)" })
    parseJson(): true {
        return true
    }
}
