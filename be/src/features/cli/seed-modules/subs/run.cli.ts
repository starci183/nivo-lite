import { CommandRunner, SubCommand } from "nest-commander"
import { ModulesService } from "@modules/domain/modules"
import { InjectLogger, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"

@SubCommand({ name: "run", description: "Upsert every module and authority action of the catalogue; deletes nothing" })
/** `cli seed-modules run`: mirrors the typed catalogue into the database and reports the rows it no longer lists. */
export class RunSeedModulesCli extends CommandRunner {
    constructor(
        private readonly modules: ModulesService,
        @InjectLogger() private readonly logger: Logger,
    ) {
        super()
    }

    /** Syncs the catalogue once and logs what was written and what is stale. */
    async run(): Promise<void> {
        const report = await this.modules.sync()
        this.logger.info(LoggingLogEvent.SeedsApplied, { seed: "modules", ...report })
    }
}
