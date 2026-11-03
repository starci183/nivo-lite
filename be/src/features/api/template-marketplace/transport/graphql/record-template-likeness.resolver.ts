import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RecordTemplateLikenessCommand } from "../../application/record-template-likeness.command"
import { LikenessGrantType } from "./dto/likeness-grant.type"
import { RecordTemplateLikenessInput } from "./dto/record-template-likeness.input"
import { toRecordTemplateLikenessRequest, toRecordTemplateLikenessType } from "./record-template-likeness.mapper"

@Resolver()
/** GraphQL door of recordTemplateLikeness. */
export class RecordTemplateLikenessResolver {
    constructor(@InjectCommandBus() private readonly bus: CommandBus) {}

    /** Records the consent of a real person to the persona of a template of the caller. */
    @Mutation(() => LikenessGrantType, { name: "recordTemplateLikeness" })
    async recordTemplateLikeness(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: RecordTemplateLikenessInput,
    ): Promise<LikenessGrantType> {
        const result = await this.bus.execute(
            new RecordTemplateLikenessCommand({ request: toRecordTemplateLikenessRequest(input), principal }),
        )
        return toRecordTemplateLikenessType(result)
    }
}
