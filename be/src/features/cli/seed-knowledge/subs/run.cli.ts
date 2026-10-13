import { CommandRunner, Option, SubCommand } from "nest-commander"
import { NivoSeedService } from "@modules/domain/nivo-knowledge"
import { InjectLogger, LoggingLogEvent } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"

/** The options of the seed command. */
interface RunOptions {
    /** The knowledge folder to read. */
    readonly dir?: string
}

@SubCommand({
    name: "run",
    description: "Upsert every base knowledge file, embed what changed and remove what the folder no longer has",
})
/** `cli seed-knowledge run [--dir <folder>]`: publishes the base knowledge of NIVO and reports what it wrote. */
export class RunSeedKnowledgeCli extends CommandRunner {
    constructor(
        private readonly seed: NivoSeedService,
        @InjectLogger() private readonly logger: Logger,
    ) {
        super()
    }

    /** Publishes the folder once and logs what was written. */
    async run(_params: Array<string>, options: RunOptions): Promise<void> {
        const report = await this.seed.seedFolder(options.dir)
        this.logger.info(LoggingLogEvent.SeedsApplied, { seed: "nivo-knowledge", ...report })
    }

    /** Reads the knowledge from another folder. */
    @Option({ flags: "-d, --dir <folder>", description: "The knowledge folder to read" })
    parseDir(value: string): string {
        return value
    }
}
