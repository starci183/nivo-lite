import type { DynamicModule } from "@nestjs/common"
import { LeadsGraphqlModule } from "@features/api/leads"
import { ContractsLinkGraphqlModule } from "@features/api/contracts-link"
import { LeadQueriesGraphqlModule } from "@features/api/lead-queries"
import { LeadActionsGraphqlModule } from "@features/api/lead-actions"
import { SalesGraphqlModule } from "@features/api/sales"
import { SalesWorkbenchGraphqlModule } from "@features/api/sales-workbench"
import { LeadActionsModule } from "@modules/domain/lead-actions"
import { SalesModule } from "@modules/domain/sales"
import { SalesWorkbenchModule } from "@modules/domain/sales-workbench"
import { LeadViewsModule } from "@modules/domain/lead-views"
import { PromoGraphqlModule } from "@features/api/promo"
import { LeadGenGraphqlModule } from "@features/api/leadgen"
import { ChatbotGraphqlModule } from "@features/api/chatbot"
import { ChatReplyGraphqlModule } from "@features/api/chatreply"
import { PromoModule } from "@modules/domain/promo"
import { ChatbotWorkbenchModule } from "@modules/domain/chatbot-workbench"
import { ChatReplyModule } from "@modules/domain/chatreply"
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
    ChatReplyModule.register({ isGlobal: true }),
    PromoGraphqlModule.register({}),
    LeadGenGraphqlModule.register({}),
    ChatbotWorkbenchModule.register({ isGlobal: true }),
    ChatbotGraphqlModule.register({}),
    ChatReplyGraphqlModule.register({}),
]
