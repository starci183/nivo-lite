import { WebhookProofsModule } from "@modules/domain/webhook-proofs"
import type { DynamicModule } from "@nestjs/common"
import { GenericHttpModule } from "@features/webhooks/generic"
import { TelegramHttpModule } from "@features/webhooks/telegram"
import { ZaloHttpModule } from "@features/webhooks/zalo"
import { VideoRenderHttpModule } from "@features/webhooks/video-render"
import { ExternalApiHttpModule } from "@features/api/external-api"
import { SystemHealthHttpModule } from "@features/api/system-health"
/** The webhooks area of the API, in registration order. */
export const webhooksModules = (): Array<DynamicModule> => [
    WebhookProofsModule.register({ isGlobal: true }),
    TelegramHttpModule.register({}),
    GenericHttpModule.register({}),
    ZaloHttpModule.register({}),
    // The one render door of every compose provider (its path names the provider, the connection and the connection's token).
    VideoRenderHttpModule.register({}),
    ExternalApiHttpModule.register({}),
    SystemHealthHttpModule.register({}),
]
