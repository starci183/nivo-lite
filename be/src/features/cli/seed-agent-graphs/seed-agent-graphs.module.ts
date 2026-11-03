import { Module } from "@nestjs/common"
import { SeedAgentGraphsCli } from "./seed-agent-graphs.cli"
import { ConfigurableModuleClass } from "./seed-agent-graphs.module-definition"

@Module({ providers: [SeedAgentGraphsCli] })
/** The seed-agent-graphs command over the graph seed of the workspace-seed capability. */
export class SeedAgentGraphsModule extends ConfigurableModuleClass {}
