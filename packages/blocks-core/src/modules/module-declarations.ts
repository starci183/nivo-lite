import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { accountingModule, paymentModule } from "./accounting"
import { chatbotModule } from "./chatbot"
import { loyaltyModule } from "./loyalty"
import { salesModule } from "./sales"

/**
 * The declaration of every module whose business runs in this package: its reads, actions, permissions and seed specs. The
 * generic door validates and runs a read or an action by its id from this list, and the one workbench route draws a
 * module's seed spec from it.
 */
export const MODULE_DECLARATIONS: ReadonlyArray<ModuleDeclaration> = [
    loyaltyModule,
    salesModule,
    chatbotModule,
    accountingModule,
    paymentModule,
]
