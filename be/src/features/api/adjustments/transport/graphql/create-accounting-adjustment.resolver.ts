import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { CreateAccountingAdjustmentCommand } from "../../application/create-accounting-adjustment.command"
import { CreateAccountingAdjustmentInput } from "./dto/create-accounting-adjustment.input"
import { CreateAccountingAdjustmentType } from "./dto/create-accounting-adjustment.type"
import {
    toCreateAccountingAdjustmentRequest,
    toCreateAccountingAdjustmentType,
} from "./create-accounting-adjustment.mapper"

@Resolver()
/** The GraphQL door of append-only accounting corrections. */
export class CreateAccountingAdjustmentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}
    /** Records a correction and its evidence line as the verified owner or manager. */
    @Mutation(() => CreateAccountingAdjustmentType, { name: "createAccountingAdjustment" })
    async createAccountingAdjustment(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: CreateAccountingAdjustmentInput,
    ): Promise<CreateAccountingAdjustmentType> {
        const result = await this.commandBus.execute(
            new CreateAccountingAdjustmentCommand({
                request: toCreateAccountingAdjustmentRequest(input, workspaceId),
                principal,
            }),
        )
        return toCreateAccountingAdjustmentType(result)
    }
}
