import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { VerifyTemplateLikenessCommand } from "../../application/verify-template-likeness.command"
import { LikenessGrantType } from "./dto/likeness-grant.type"
import { LikenessGrantIdInput } from "./dto/likeness-grant-id.input"
import { toVerifyTemplateLikenessRequest, toVerifyTemplateLikenessType } from "./verify-template-likeness.mapper"

@Resolver()
/** GraphQL door of verifyTemplateLikeness. */
export class VerifyTemplateLikenessResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** A platform reviewer confirms the identity of the person behind a consent record. */
    @Mutation(() => LikenessGrantType, { name: "verifyTemplateLikeness" })
    async verifyTemplateLikeness(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: LikenessGrantIdInput,
    ): Promise<LikenessGrantType> {
        const result = await this.commandBus.execute(
            new VerifyTemplateLikenessCommand({ request: toVerifyTemplateLikenessRequest(input), principal }),
        )
        return toVerifyTemplateLikenessType(result)
    }
}
