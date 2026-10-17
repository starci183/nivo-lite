import type { DynamicModule } from "@nestjs/common"
import { AiQuotaOverridesModule } from "@modules/domain/ai-quota-overrides"
import { PlatformAdminModule } from "@modules/domain/platform-admin"
import { PlatformAuditModule } from "@modules/domain/platform-audit"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import type { ApiOptions } from "../api.options"
/** The admin area of the API, in registration order. */
export const adminModules = (options: ApiOptions): Array<DynamicModule> => [
    PlatformAuditModule.register({ isGlobal: true }),
    AiQuotaOverridesModule.register({ isGlobal: true }),
    PlatformAdminModule.register({ isGlobal: true, ...options.platformAdmin }),
    AuthorityActionsModule.register({ isGlobal: true }),
]
