import { Command, CommandRunner } from "nest-commander"
import { UploadSeedMediaCli } from "./subs/upload.cli"

@Command({
    name: "seed-media",
    description: "The shared media every workspace renders with",
    subCommands: [UploadSeedMediaCli],
})
/** `cli seed-media`: the media group; its commands are the sub-commands (`cli seed-media upload`). */
export class SeedMediaCli extends CommandRunner {
    /** Without a sub-command the group shows its help. */
    run(): Promise<void> {
        return this.command.help()
    }
}
