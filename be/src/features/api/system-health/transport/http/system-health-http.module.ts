import { Module } from "@nestjs/common"
import { SystemHealthModule } from "../../system-health.module"
import { LiveController } from "./live.controller"
import { ProbeAliasController } from "./probe-alias.controller"
import { ConfigurableModuleClass } from "./system-health-http.module-definition"

@Module({ imports: [SystemHealthModule.register({})], controllers: [LiveController, ProbeAliasController] })
/** The HTTP transport of the health feature: liveness and readiness endpoints with the stack and edge probe aliases. */
export class SystemHealthHttpModule extends ConfigurableModuleClass {}
