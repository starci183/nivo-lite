import { Command, CommandRunner } from "nest-commander"
import { BootstrapStorageCli } from "./subs/bootstrap.cli"

@Command({
    name: "storage",
    description: "The S3 object store (MinIO) files live in",
    subCommands: [BootstrapStorageCli],
})
/** `cli storage`: the storage group; its commands are the sub-commands (`cli storage bootstrap`). */
export class StorageCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
