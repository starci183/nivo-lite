import { Module } from "@nestjs/common"
import { ConfigurableModuleClass } from "./video-render-http.module-definition"
import { VideoRenderWebhook } from "./video-render.webhook"

@Module({ controllers: [VideoRenderWebhook] })
/**
 * The HTTP transport of every compose provider's render webhook: one door for all of them. The proof (`ScopedWebhookVerifier`, the
 * proofs `VideoRenderProofsService` registered) and the intake (`VideoRenderIntakeService`) come from the app's `VideoRenderDoorModule`.
 */
export class VideoRenderHttpModule extends ConfigurableModuleClass {}
