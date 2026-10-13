import { Body, Controller, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RequestRenderCommand } from "../../application/request-render.command"
import { toRequestRenderRequest, toRequestRenderResponse } from "./renders.mapper"
import { RequestRenderRequest } from "./dto/request-render.request"
import { RequestRenderResponse } from "./dto/request-render.response"

@Controller("video/renders")
/** HTTP door of the renders. */
export class RendersController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Queues the render of a video project of the authenticated caller; the render waits for its job. */
    @Post()
    async requestRender(
        @CurrentPrincipal() principal: Principal,
        @Body() input: RequestRenderRequest,
    ): Promise<RequestRenderResponse> {
        const result = await this.commandBus.execute(
            new RequestRenderCommand({ request: toRequestRenderRequest(input), principal }),
        )
        return toRequestRenderResponse(result)
    }
}
