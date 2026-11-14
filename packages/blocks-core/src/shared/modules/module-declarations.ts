import type { ModuleDeclaration } from "@nivo-lite/agent-sdk/module"
import { bookingModule } from "../../agents/booking"
import { chatbotModule } from "../../agents/chatbot"
import { contentModule } from "../../agents/content"
import { hiringModule } from "../../agents/hiring"
import { platformModule } from "../platform"
import { salesModule } from "../../agents/sales"
import { videoModule } from "../../agents/video"

/**
 * The declaration of every module whose business runs in this package: its reads, actions, permissions and seed specs. The
 * generic door validates and runs a read or an action by its id from this list, and the one workbench route draws a
 * module's seed spec from it.
 */
export const MODULE_DECLARATIONS: ReadonlyArray<ModuleDeclaration> = [
    salesModule,
    chatbotModule,
    platformModule,
    hiringModule,
    bookingModule,
    videoModule,
    contentModule,
]
