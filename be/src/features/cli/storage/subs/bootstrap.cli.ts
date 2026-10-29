import { CommandRunner, SubCommand } from "nest-commander"
import { StorageBootstrapService } from "@modules/integrations/object-storage"

@SubCommand({
    name: "bootstrap",
    description: "Create the buckets of this environment (avatars are public-read) when they are missing",
})
/** `cli storage bootstrap`: idempotent bucket set-up, run once per environment before the first upload. */
export class BootstrapStorageCli extends CommandRunner {
    constructor(private readonly bootstrap: StorageBootstrapService) {
        super()
    }

    /** Ensures every bucket. */
    async run(): Promise<void> {
        await this.bootstrap.bootstrap()
    }
}
