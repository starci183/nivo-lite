import { Module } from "@nestjs/common"
import { SystemHealthModule } from "../../system-health.module"
import { LiveController } from "./live.controller"
import { ProbeAliasController } from "./probe-alias.controller"

@Module({ imports: [SystemHealthModule], controllers: [LiveController, ProbeAliasController] })
/** The HTTP transport of the health feature: liveness and readiness endpoints with the stack and edge probe aliases. */
export class SystemHealthHttpModule {}
