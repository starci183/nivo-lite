import { Module } from "@nestjs/common"
import { BrainPoliciesCli } from "./brain-policies.cli"
import { ConfigurableModuleClass } from "./brain-policies.module-definition"
import { BackfillBrainPoliciesCli } from "./subs/backfill.cli"

@Module({ providers: [BrainPoliciesCli, BackfillBrainPoliciesCli] })
/** The brain-policies group: the command and its one sub-command over the policy derivations of the second brain. */
export class BrainPoliciesCliModule extends ConfigurableModuleClass {}
