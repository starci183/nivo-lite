import { Module } from "@nestjs/common"
import { DeriveBrainPoliciesHandler } from "./application/derive-brain-policies.handler"
import { GetBrainPoliciesHandler } from "./application/get-brain-policies.handler"
import { GetBrainPolicyHandler } from "./application/get-brain-policy.handler"
import { SetBrainPolicyHandler } from "./application/set-brain-policy.handler"
import { UnsetBrainPolicyHandler } from "./application/unset-brain-policy.handler"
import { ConfigurableModuleClass } from "./brain-policies.module-definition"

@Module({
    providers: [
        GetBrainPoliciesHandler,
        GetBrainPolicyHandler,
        SetBrainPolicyHandler,
        UnsetBrainPolicyHandler,
        DeriveBrainPoliciesHandler,
    ],
})
/** The Policies tab of the Second Brain: the handlers of its application. */
export class BrainPoliciesApiModule extends ConfigurableModuleClass {}
