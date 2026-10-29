import { Module, type DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { AuthGuard, CredentialGuard } from "@modules/domain/identity"
import { authenticationModules } from "./compose/authentication"
import { ErrorsFilter } from "@modules/platform/errors"
import { OriginGuard, RateLimitGuard } from "@modules/platform/http-security"
import { API_JOB_QUEUES } from "./compose/jobs"
import { API_REACTORS } from "./compose/reactors"
import type { ApiOptions } from "./api.options"
import { platformModules } from "./compose/platform"
import { identityModules } from "./compose/identity"
import { connectionsModules } from "./compose/connections"
import { automationsModules } from "./compose/automations"
import { messagingModules } from "./compose/messaging"
import { videoModules } from "./compose/video"
import { businessModules } from "./compose/business"
import { contentModules } from "./compose/content"
import { systemModules } from "./compose/system"
import { knowledgeModules } from "./compose/knowledge"
import { bookingsModules } from "./compose/bookings"
import { salesModules } from "./compose/sales"
import { adminModules } from "./compose/admin"
import { agentsModules } from "./compose/agents"
import { accountingModules } from "./compose/accounting"
import { agentApiModules } from "./compose/agent-api"
import { modulesModules } from "./compose/modules"
import { billingModules } from "./compose/billing"
import { webhooksModules } from "./compose/webhooks"
import { loyaltyModules } from "./compose/loyalty"
import { apiModules } from "./compose/api"
import { realtimeModules } from "./compose/realtime"

@Module({})
/** Every capability is registered once and the four guards run in a fixed order. */
export class AppModule {
    /** Builds the module from options parsed once at boot; nothing here reads the environment. */
    static register(options: ApiOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ...platformModules(options),
                ...authenticationModules(options),
                ...identityModules(options),
                ...connectionsModules(options),
                ...automationsModules(options),
                ...messagingModules(options),
                ...videoModules(options),
                ...businessModules(options),
                ...API_JOB_QUEUES,
                ...API_REACTORS,
                ...contentModules(options),
                ...systemModules(),
                ...knowledgeModules(options),
                ...bookingsModules(),
                ...salesModules(),
                ...adminModules(options),
                ...agentsModules(options),
                ...accountingModules(),
                ...agentApiModules(),
                ...modulesModules(),
                ...billingModules(options),
                ...webhooksModules(),
                ...loyaltyModules(options),
                ...apiModules(),
                ...realtimeModules(),
            ],
            providers: [
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: CredentialGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}
