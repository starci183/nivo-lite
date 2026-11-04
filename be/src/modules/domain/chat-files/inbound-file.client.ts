import { readFile, stat } from "node:fs/promises"
import { Injectable } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatFilesLogEvent } from "./chat-files.log-events"

/** Reads a local file of a manual import. */
export interface InboundFileReader {
    /** The bytes of the file at `path`, or null when it is missing, not a file or larger than `maxBytes`. */
    read(path: string, maxBytes: number): Promise<Uint8Array | null>
}

@Injectable()
/** Reads local files with the file system: only the files a manual import named, already checked to sit inside the import folder. */
export class InboundFileReaderClient implements InboundFileReader {
    constructor(@InjectLogger() private readonly logger: Logger) {}

    /** The bytes of the file at `path`, or null when it is missing, not a file or larger than `maxBytes`; a file it could not read is logged. */
    async read(path: string, maxBytes: number): Promise<Uint8Array | null> {
        const facts = await stat(path).catch(() => {
            this.logger.warn(ChatFilesLogEvent.ImportFileUnreadable, { path })
            return null
        })
        if (facts === null || !facts.isFile() || facts.size > maxBytes) return null
        return readFile(path).catch(() => {
            this.logger.warn(ChatFilesLogEvent.ImportFileUnreadable, { path })
            return null
        })
    }
}
