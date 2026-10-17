import { Module } from "@nestjs/common"
import { AutomationsApiModule } from "../../automations.module"
import { ConfigurableModuleClass } from "./automations-graphql.module-definition"
import { EmitAutomationEventResolver } from "./emit-automation-event.resolver"
import { GetAutomationsResolver } from "./get-automations.resolver"
import { ListAutomationGoogleAccountsResolver } from "./list-automation-google-accounts.resolver"
import { ListAutomationRunsResolver } from "./list-automation-runs.resolver"
import { ProposeAutomationBodyResolver } from "./propose-automation-body.resolver"
import { RunAutomationNowResolver } from "./run-automation-now.resolver"
import { SuggestAutomationsResolver } from "./suggest-automations.resolver"
import { UpdateAutomationPipelineResolver } from "./update-automation-pipeline.resolver"

@Module({
    imports: [AutomationsApiModule.register({})],
    providers: [
        GetAutomationsResolver,
        ListAutomationRunsResolver,
        ListAutomationGoogleAccountsResolver,
        SuggestAutomationsResolver,
        EmitAutomationEventResolver,
        UpdateAutomationPipelineResolver,
        ProposeAutomationBodyResolver,
        RunAutomationNowResolver,
    ],
})
/** The GraphQL transport of the automations feature. */
export class AutomationsGraphqlModule extends ConfigurableModuleClass {}
