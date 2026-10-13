import { Injectable } from "@nestjs/common"
import { AppCommandsService } from "@modules/domain/app-commands"
import { DomainError } from "@modules/platform/errors"
import { renderRequestPayloadOf } from "@modules/queues/render-request"
import { VideoService } from "./video.service"

@Injectable()
/**
 * Serves the render commands the web app writes to the database: the render is opened and its render-video job queued as the person
 * who asked, and the asker finds the answer (or the code of the refusal) on the command row.
 */
export class VideoRenderCommandsService {
    constructor(
        private readonly commands: AppCommandsService,
        private readonly video: VideoService,
    ) {}

    /**
     * Serves the command a claimed job names. A refusal of the domain (project not found, busy, an invalid spec, a seat that may not
     * render) settles the command as failed with its code; any other failure is thrown so the queue retries the delivery. A payload that
     * names no command, or a command already settled, is left as it is.
     */
    async run(payload: object): Promise<void> {
        const named = renderRequestPayloadOf(payload)
        if (named === null) return
        const command = await this.commands.begin(named.commandId)
        if (command === null) return
        const projectId = typeof command.input.projectId === "string" ? command.input.projectId : ""
        try {
            const queued = await this.video.requestRender(command.requestedBy, projectId)
            await this.commands.succeed(command.id, { renderId: queued.renderId, projectId: queued.projectId })
        } catch (cause) {
            if (!(cause instanceof DomainError)) throw cause
            await this.commands.fail(command.id, cause.code)
        }
    }

    /** Settles the command of a job that ran out of attempts, so the asker stops waiting. */
    async abandon(payload: object): Promise<void> {
        const named = renderRequestPayloadOf(payload)
        if (named !== null) await this.commands.fail(named.commandId, "unavailable")
    }
}
