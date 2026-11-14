import { Module, type DynamicModule, type OnApplicationBootstrap } from "@nestjs/common"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./video-compose.module-definition"
import { VideoComposeRegistryService } from "./video-compose-registry.service"
import { VideoComposeNativeService } from "./video-compose.service"
import { VideoRenderIntakeService } from "./video-render-intake.service"
import { VideoRenderProofsService } from "./video-render-proofs.service"
import { renderTriggerOf } from "./video-render.trigger"

const EXPORTED = [VideoComposeRegistryService, VideoComposeNativeService, VideoRenderIntakeService]

@Module({})
/**
 * The generic compose purpose (`nivo.tool.video.compose`, `nivo.tool.video.render.get`) and its render door's domain side: the registry
 * each compose provider module registers its port in, the tool family the app passes to the gateway's `natives`
 * (`NATIVE_TOOL_ADAPTERS`), the proofs of the providers' webhooks and the intake that keeps a finished render as one `<provider>.render`
 * row and fires `render.completed`. Both apps register it globally (the mcp app runs the agents' calls, the api app takes the webhooks);
 * it needs the connections, the account-data intake and the webhook proof registry, all registered globally by the app. Once every
 * compose provider has registered its port, the render trigger of each is registered (one declaration per provider, the generic translate).
 */
export class VideoComposeModule extends ConfigurableModuleClass implements OnApplicationBootstrap {
    constructor(private readonly composers: VideoComposeRegistryService) {
        super()
    }

    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ...EXPORTED, VideoRenderProofsService], exports: EXPORTED }
    }

    /** Registers the render trigger of every compose provider that registered its port. */
    onApplicationBootstrap(): void {
        triggerDeclarations.register(...this.composers.all().map((port) => renderTriggerOf(port.provider)))
    }
}
