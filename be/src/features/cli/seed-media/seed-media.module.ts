import { Module } from "@nestjs/common"
import { SeedMediaCli } from "./seed-media.cli"
import { ConfigurableModuleClass } from "./seed-media.module-definition"
import { UploadSeedMediaCli } from "./subs/upload.cli"

@Module({ providers: [SeedMediaCli, UploadSeedMediaCli] })
/** The seed-media group: the command that uploads the music beds; the music capability is composed by the cli app. */
export class SeedMediaModule extends ConfigurableModuleClass {}
