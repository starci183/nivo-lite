import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentToolsService } from "./agent-tools.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-tools.module-definition"

@Module({})
/**
 * The tool bridge OpenClaw calls through: manifest, token issue and tool dispatch. The ports (knowledge, leads, booking, approvals, handoff)
 * are bound by the app root; the OpenClaw and events capabilities must be reachable from it.
 */
export class AgentToolsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), AgentToolsService], exports: [AgentToolsService] }
    }
}
