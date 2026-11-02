import { Injectable } from "@nestjs/common"
import type { GraphFactReader } from "./agent-graphs.port"

@Injectable()
/** Holds the configured fact readers independently of their dependencies, so the gateway can construct its graph gate. */
export class GraphFactReadersService {
    private readonly readers: Array<GraphFactReader> = []

    /** The stable read-only view consumed by the fact service before and after composition completes. */
    all(): ReadonlyArray<GraphFactReader> {
        return this.readers
    }

    /** Populates the existing view once the configured reader providers have been constructed. */
    register(readers: ReadonlyArray<GraphFactReader>): ReadonlyArray<GraphFactReader> {
        this.readers.splice(0, this.readers.length, ...readers)
        return this.readers
    }
}
