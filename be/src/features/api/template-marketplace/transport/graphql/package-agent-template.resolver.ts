import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PackageAgentTemplateCommand } from "../../application/package-agent-template.command"
import { TemplateVersionType } from "./dto/template-version.type"
import { PackageAgentTemplateInput } from "./dto/package-agent-template.input"
import { toPackageAgentTemplateRequest, toPackageAgentTemplateType } from "./package-agent-template.mapper"

@Resolver()
/** GraphQL door of packageAgentTemplate. */
export class PackageAgentTemplateResolver {
    constructor(@InjectCommandBus() private readonly bus: CommandBus) {}

    /** Packages a frozen version of an agent as the next version of a template of the caller. */
    @Mutation(() => TemplateVersionType, { name: "packageAgentTemplate" })
    async packageAgentTemplate(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PackageAgentTemplateInput,
    ): Promise<TemplateVersionType> {
        const result = await this.bus.execute(
            new PackageAgentTemplateCommand({ request: toPackageAgentTemplateRequest(workspaceId, input), principal }),
        )
        return toPackageAgentTemplateType(result)
    }
}
