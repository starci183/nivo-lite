import type { DynamicModule } from "@nestjs/common"
import { AiQuotaOverridesModule } from "@modules/domain/ai-quota-overrides"
import {
    PLATFORM_ADMIN_ERROR_KINDS,
    PLATFORM_ADMIN_MESSAGES,
    PlatformAdminModule,
} from "@modules/domain/platform-admin"
import { PlatformAuditModule } from "@modules/domain/platform-audit"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import type { ApiOptions } from "../api.options"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The admin area of the API, in registration order. */
export const adminModules = (options: ApiOptions): Array<DynamicModule> => [
    PlatformAuditModule.register({ isGlobal: true }),
    AiQuotaOverridesModule.register({ isGlobal: true }),
    PlatformAdminModule.register({ isGlobal: true, ...options.platformAdmin }),
    AuthorityActionsModule.register({ isGlobal: true }),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const adminErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [PLATFORM_ADMIN_ERROR_KINDS]

/** The message bundles of the capabilities this group registers, in registration order. */
export const adminMessages: ReadonlyArray<MessageBundle> = [PLATFORM_ADMIN_MESSAGES]
