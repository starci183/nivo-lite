import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { SimulateInboundCommand } from "../../application/simulate-inbound.command"
import { toSimulateInboundRequest, toSimulateInboundType } from "./simulate-inbound.mapper"
import { SimulateInboundInput } from "./dto/simulate-inbound.input"
import { SimulateInboundType } from "./dto/simulate-inbound.type"

@Resolver()
/** The GraphQL mutation that records a simulated input and immediately queues its work. */
export class SimulateInboundResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Enqueues the existing decisions job; the status query exposes its result. */
    @Mutation(() => SimulateInboundType, { name: "simulateInbound" })
    async simulateInbound(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: SimulateInboundInput,
    ): Promise<SimulateInboundType> {
        const result = await this.commandBus.execute(
            new SimulateInboundCommand({ request: toSimulateInboundRequest(workspaceId, locale, input), principal }),
        )
        return toSimulateInboundType(result)
    }
}
