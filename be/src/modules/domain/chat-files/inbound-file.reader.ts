import { readFile, stat } from "node:fs/promises"
import { Injectable } from "@nestjs/common"

/** Reads a local file of a manual import. */
export interface InboundFileReader {
    /** The bytes of the file at `path`, or null when it is missing, not a file or larger than `maxBytes`. */
    read(path: string, maxBytes: number): Promise<Uint8Array | null>
}

@Injectable()
/** Reads local files with the file system: only the files a manual import named, already checked to sit inside the import folder. */
export class NodeInboundFileReader implements InboundFileReader {
    /** The bytes of the file at `path`, or null when it is missing, not a file or larger than `maxBytes`. */
    async read(path: string, maxBytes: number): Promise<Uint8Array | null> {
        const facts = await stat(path).catch(() => null)
        if (facts === null || !facts.isFile() || facts.size > maxBytes) return null
        return readFile(path).catch(() => null)
    }
}
