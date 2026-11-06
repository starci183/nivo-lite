import { Module } from "@nestjs/common"
import { DecisionsApiModule } from "../../decisions.module"
import { ApproverDirectoryResolver } from "./approver-directory.resolver"
import { AuthorityResolver } from "./authority.resolver"
import { ConfigurableModuleClass } from "./decisions-graphql.module-definition"
import { MemberGrantsResolver } from "./member-grants.resolver"
import { SaveAuthorityRuleResolver } from "./save-authority-rule.resolver"
import { SaveMemberGrantsResolver } from "./save-member-grants.resolver"
import { UpdateAuthorityResolver } from "./update-authority.resolver"

@Module({
    imports: [DecisionsApiModule.register({})],
    providers: [
        AuthorityResolver,
        UpdateAuthorityResolver,
        SaveAuthorityRuleResolver,
        ApproverDirectoryResolver,
        MemberGrantsResolver,
        SaveMemberGrantsResolver,
    ],
})
/** The GraphQL transport of the governance doors: the authority sheet and its rules, the approver directory and the member grants. */
export class DecisionsGraphqlModule extends ConfigurableModuleClass {}
