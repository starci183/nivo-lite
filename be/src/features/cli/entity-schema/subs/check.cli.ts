import { CommandRunner, SubCommand } from "nest-commander"
import { EntityPlannerService } from "@modules/domain/entity-planner"

@SubCommand({ name: "check", description: "Fail unless the database and the entities manifest match the declarations" })
/** `cli entities check`: delegates to the entity planner, whose failure ends the command non-zero. */
export class CheckCli extends CommandRunner {
    constructor(private readonly planner: EntityPlannerService) {
        super()
    }

    /** Checks once and propagates the refusal. */
    async run(): Promise<void> {
        await this.planner.check(process.stdout)
    }
}
