import { Module } from "@nestjs/common"
import { AttachSandboxAccountHandler } from "./application/attach-sandbox-account.handler"
import { DetachSandboxAccountHandler } from "./application/detach-sandbox-account.handler"
import { ExpireSandboxWaitHandler } from "./application/expire-sandbox-wait.handler"
import { OpenSandboxAccountHandler } from "./application/open-sandbox-account.handler"
import { ProviderSandboxStateHandler } from "./application/provider-sandbox-state.handler"
import { ResetSandboxAccountHandler } from "./application/reset-sandbox-account.handler"
import { SandboxAccountsHandler } from "./application/sandbox-accounts.handler"
import { SandboxCallsHandler } from "./application/sandbox-calls.handler"
import { SandboxCasesHandler } from "./application/sandbox-cases.handler"
import { SandboxKeyHandler } from "./application/sandbox-key.handler"
import { SandboxLatestRequestHandler } from "./application/sandbox-latest-request.handler"
import { SandboxNextCasesHandler } from "./application/sandbox-next-cases.handler"
import { SandboxProvidersHandler } from "./application/sandbox-providers.handler"
import { SandboxWaitingRunsHandler } from "./application/sandbox-waiting-runs.handler"
import { SandboxAttachmentsService } from "./application/sandbox-attachments.service"
import { SendSandboxCaseHandler } from "./application/send-sandbox-case.handler"
import { SetSandboxNextCaseHandler } from "./application/set-sandbox-next-case.handler"
import { ConfigurableModuleClass } from "./provider-sandbox.module-definition"

@Module({
    providers: [
        SandboxAttachmentsService,
        ProviderSandboxStateHandler,
        SandboxProvidersHandler,
        SandboxAccountsHandler,
        SandboxCasesHandler,
        SandboxLatestRequestHandler,
        SandboxNextCasesHandler,
        SandboxCallsHandler,
        SandboxKeyHandler,
        SandboxWaitingRunsHandler,
        OpenSandboxAccountHandler,
        AttachSandboxAccountHandler,
        DetachSandboxAccountHandler,
        SendSandboxCaseHandler,
        SetSandboxNextCaseHandler,
        ResetSandboxAccountHandler,
        ExpireSandboxWaitHandler,
    ],
})
/**
 * The provider-sandbox feature (dev Sandbox page, rulings R60, R62, R66): the handlers of its application. The capabilities it asks
 * (the sandbox doors, the tools console, the connection grants, the provider triggers, the engine's wait expiry, the agent directory, the contacts) are global modules of the api app.
 */
export class ProviderSandboxApiModule extends ConfigurableModuleClass {}
