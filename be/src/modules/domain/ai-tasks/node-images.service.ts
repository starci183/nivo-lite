import { Injectable } from "@nestjs/common"
import { InjectRemoteFiles, type RemoteFiles } from "@modules/integrations/remote-files"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AiTasksLogEvent } from "./ai-tasks.log-events"

/** The largest picture a model call carries, bytes: a larger one is left out and logged. */
export const IMAGE_MAX_BYTES: number = 5 * 1024 * 1024

/** How long one picture may take to read from the store, milliseconds. */
const IMAGE_TIMEOUT_MS = 15_000

/** The media type of a `content-type` value, without its parameters. */
const mediaTypeOf = (declared: string): string => declared.split(";", 1).join("").trim()

/** The pictures a call carries, inlined, and how many were left out. */
export interface InlinedImages {
    /** The pictures as data URLs. */
    readonly images: ReadonlyArray<string>
    /** The pictures that could not be read, were not pictures, or were too large. */
    readonly dropped: number
}

@Injectable()
/**
 * Turns the short-lived addresses of the store's pictures into data URLs before a model call. The addresses are signed for the app's own
 * object store, which a model provider outside the deployment cannot reach, so the bytes travel in the request. A picture is read once,
 * within the timeout, must say it is an image and stay within the size cap; any other is left out and logged, never sent as an address.
 */
export class NodeImagesService {
    constructor(
        @InjectRemoteFiles() private readonly files: RemoteFiles,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The pictures inlined, in order, with the count of those left out. */
    async inline(urls: ReadonlyArray<string>): Promise<InlinedImages> {
        const read = await Promise.all(urls.map((url) => this.dataUrlOf(url)))
        const images = read.filter((image): image is string => image !== null)
        if (images.length < urls.length) {
            this.logger.warn(AiTasksLogEvent.ImagesDropped, {
                dropped: urls.length - images.length,
                sent: images.length,
            })
        }
        return { images, dropped: urls.length - images.length }
    }

    private async dataUrlOf(url: string): Promise<string | null> {
        try {
            const file = await this.files.read({
                url,
                maxBytes: IMAGE_MAX_BYTES,
                timeoutMs: IMAGE_TIMEOUT_MS,
                accepts: (declared) => mediaTypeOf(declared).startsWith("image/"),
            })
            return file.bytes === null
                ? null
                : `data:${mediaTypeOf(file.contentType)};base64,${file.bytes.toString("base64")}`
        } catch (cause) {
            this.logger.warn(AiTasksLogEvent.ImageUnreadable, {
                error: cause instanceof Error ? cause.name : typeof cause,
            })
            return null
        }
    }
}
