import { Module } from "@nestjs/common"
import { GetAutomationsHandler } from "./application/get-automations.handler"
import { ListRunsHandler } from "./application/list-runs.handler"
import { UpdatePipelineHandler } from "./application/update-pipeline.handler"
import { ProposeBodyHandler } from "./application/propose-body.handler"
import { RunNowHandler } from "./application/run-now.handler"
import { ListGoogleAccountsHandler } from "./application/list-google-accounts.handler"
import { SuggestAutomationsHandler } from "./application/suggest-automations.handler"
import { EmitEventHandler } from "./application/emit-event.handler"
import { ConfigurableModuleClass } from "./automations.module-definition"

@Module({
    providers: [
        GetAutomationsHandler,
        ListRunsHandler,
        UpdatePipelineHandler,
        ProposeBodyHandler,
        RunNowHandler,
        ListGoogleAccountsHandler,
        SuggestAutomationsHandler,
        EmitEventHandler,
    ],
})
/** The automations feature: the handlers of its application. */
export class AutomationsApiModule extends ConfigurableModuleClass {}
