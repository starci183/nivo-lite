import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RequestRenderRequest, RequestRenderResult } from "./request-render.contracts"

/** Asks to render a video project of the authenticated caller. */
export class RequestRenderCommand extends Command<RequestRenderResult> {
    constructor(readonly params: ExecuteParams<RequestRenderRequest>) {
        super()
    }
}
