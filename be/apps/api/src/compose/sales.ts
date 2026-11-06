import type { DynamicModule } from "@nestjs/common"
import { LeadsGraphqlModule } from "@features/api/leads"
import { ContractsLinkGraphqlModule } from "@features/api/contracts-link"
import { LeadQueriesGraphqlModule } from "@features/api/lead-queries"
import { LeadActionsGraphqlModule } from "@features/api/lead-actions"
import { SalesGraphqlModule } from "@features/api/sales"
import { SalesWorkbenchGraphqlModule } from "@features/api/sales-workbench"
import { LEAD_ACTIONS_ERROR_KINDS, LEAD_ACTIONS_MESSAGES, LeadActionsModule } from "@modules/domain/lead-actions"
import { SalesModule } from "@modules/domain/sales"
import { SalesWorkbenchModule } from "@modules/domain/sales-workbench"
import { LeadViewsModule } from "@modules/domain/lead-views"
import { PromoGraphqlModule } from "@features/api/promo"
import { LeadGenGraphqlModule } from "@features/api/leadgen"
import { PromoModule } from "@modules/domain/promo"
import type { ErrorKind } from "@modules/platform/errors"
import type { MessageBundle } from "@modules/platform/i18n"
/** The sales area of the API, in registration order. */
export const salesModules = (): Array<DynamicModule> => [
    LeadsGraphqlModule.register({}),
    ContractsLinkGraphqlModule.register({}),
    LeadQueriesGraphqlModule.register({}),
    LeadActionsGraphqlModule.register({}),
    SalesGraphqlModule.register({}),
    SalesWorkbenchGraphqlModule.register({}),
    LeadActionsModule.register({ isGlobal: true }),
    LeadViewsModule.register({ isGlobal: true }),
    SalesModule.register({ isGlobal: true }),
    SalesWorkbenchModule.register({ isGlobal: true }),
    PromoModule.register({ isGlobal: true }),
    PromoGraphqlModule.register({}),
    LeadGenGraphqlModule.register({}),
]

/** The error kinds of the capabilities this group registers, in registration order. */
export const salesErrorKinds: ReadonlyArray<Readonly<Record<string, ErrorKind>>> = [LEAD_ACTIONS_ERROR_KINDS]

/** The message bundles of the capabilities this group registers, in registration order. */
export const salesMessages: ReadonlyArray<MessageBundle> = [LEAD_ACTIONS_MESSAGES]
