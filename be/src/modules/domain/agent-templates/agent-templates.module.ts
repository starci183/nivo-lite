import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AgentTemplateInstallerService } from "./agent-template-installer.service"
import { AgentTemplateVersionsService } from "./agent-template-versions.service"
import { AgentTemplatesService } from "./agent-templates.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-templates.module-definition"

@Module({})
/**
 * The process of an agent packaged as data: the allowlist packager, the immutable versions, and the installer that turns a package
 * and the values of a buyer into an agent in shadow mode with the provenance of its branches.
 */
export class AgentTemplatesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const services = [AgentTemplateVersionsService, AgentTemplatesService, AgentTemplateInstallerService]
        return {
            ...base,
            providers: [...(base.providers ?? []), ...services],
            exports: services,
        }
    }
}
