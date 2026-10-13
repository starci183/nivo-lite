import { join } from "node:path"
import { CommandRunner, Option, SubCommand } from "nest-commander"
import { VideoMusicService } from "@modules/domain/video-music"

/** What the command line carries. */
interface UploadOptions {
    /** The folder holding `music/<track>.mp3`. */
    readonly dir: string
}

@SubCommand({
    name: "upload",
    description: "Upload the music beds of src/assets/media-seed to the media bucket (replaces earlier ones)",
})
/** `cli seed-media upload`: writes every bundled music bed to `music/<track>.mp3` of the media bucket, where the video renderer reads it. */
export class UploadSeedMediaCli extends CommandRunner {
    constructor(private readonly music: VideoMusicService) {
        super()
    }

    /** Uploads the beds of the seed folder. */
    async run(_passed: Array<string>, options: UploadOptions): Promise<void> {
        await this.music.upload(options.dir)
    }

    /** The seed folder; it defaults to `src/assets/media-seed` under the folder the cli starts in (`be/`). */
    @Option({
        flags: "--dir <dir>",
        description: "The folder holding music/<track>.mp3",
        defaultValue: join("src", "assets", "media-seed"),
    })
    parseDir(value: string): string {
        return value
    }
}
