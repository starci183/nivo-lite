import { Module } from "@nestjs/common"
import { CheckLivenessHandler } from "./application/check-liveness.handler"
import { CheckReadinessHandler } from "./application/check-readiness.handler"
import { ConfigurableModuleClass } from "./system-health.module-definition"

@Module({ providers: [CheckLivenessHandler, CheckReadinessHandler] })
/** Application module of the health feature: process-local liveness and dependency-backed readiness probes. */
export class SystemHealthModule extends ConfigurableModuleClass {}
