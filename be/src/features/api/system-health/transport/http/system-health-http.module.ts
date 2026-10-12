import { Module } from "@nestjs/common"
import { SystemHealthModule } from "../../system-health.module"
import { LiveController } from "./live.controller"
import { ProbeAliasController } from "./probe-alias.controller"

@Module({ imports: [SystemHealthModule], controllers: [LiveController, ProbeAliasController] })
/** The HTTP transport of the health feature: the liveness door and the legacy probe paths that alias it. */
export class SystemHealthHttpModule {}
