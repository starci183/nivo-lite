import { Module } from "@nestjs/common"
import { ToolReseedModule } from "@modules/domain/tool-reseed"
import { ToolsCli } from "./tools.cli"
import { ConfigurableModuleClass } from "./tools.module-definition"
import { ReseedToolsCli } from "./subs/reseed.cli"

@Module({ imports: [ToolReseedModule.register({})], providers: [ToolsCli, ReseedToolsCli] })
/** The tools group: the command and its sub-command over the tool ids stored in a workspace (reseed). */
export class ToolsCliModule extends ConfigurableModuleClass {}
