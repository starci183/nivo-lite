import { WebhookProofsModule } from "@modules/domain/webhook-proofs"
import type { DynamicModule } from "@nestjs/common"
import { TelegramHttpModule } from "@features/webhooks/telegram"
import { ZaloHttpModule } from "@features/webhooks/zalo"
import { ExternalApiHttpModule } from "@features/api/external-api"
import { SystemHealthHttpModule } from "@features/api/system-health"
/** The webhooks area of the API, in registration order. */
export const webhooksModules = (): Array<DynamicModule> => [
    WebhookProofsModule.register({ isGlobal: true }),
    TelegramHttpModule.register({}),
    ZaloHttpModule.register({}),
    ExternalApiHttpModule.register({}),
    SystemHealthHttpModule.register({}),
]
