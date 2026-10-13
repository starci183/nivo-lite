import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { Public, PublicReason } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { RateLimit, RateTier } from "@modules/platform/http-security"
import { RespondHiringInterviewCommand } from "../../application/respond-hiring-interview.command"
import { RespondSlotType } from "./dto/respond-slot.type"
import { RespondHiringInterviewInput } from "./dto/respond-hiring-interview.input"
import { toRespondHiringInterviewRequest, toRespondSlotType } from "./hiring-public.mapper"

@Resolver()
/** GraphQL door: pick an interview time from the candidate's link. */
export class RespondHiringInterviewResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Pick an interview time from the candidate's link. */
    @Public({ reason: PublicReason.PublicForm })
    @RateLimit(RateTier.Strict)
    @Mutation(() => RespondSlotType, { name: "respondHiringInterview" })
    async respondHiringInterview(@Args("input") input: RespondHiringInterviewInput): Promise<RespondSlotType> {
        const result = await this.commandBus.execute(
            new RespondHiringInterviewCommand({ request: toRespondHiringInterviewRequest(input) }),
        )
        return toRespondSlotType(result)
    }
}
