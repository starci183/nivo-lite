import { Injectable } from "@nestjs/common"
import { InjectGraphFactReaders } from "./agent-graphs.decorators"
import type { FactRegistry } from "./agent-graphs.contracts"
import type { GraphFactReader } from "./agent-graphs.port"

@Injectable()
/**
 * The registry of the facts the modules declare, which the checks of a saved or published graph read to know a condition's fact. No
 * fact's value is read: no engine gate walks a graph (2026-11-13).
 */
export class GraphFactsService {
    constructor(@InjectGraphFactReaders() private readonly readers: ReadonlyArray<GraphFactReader>) {}

    /** Every fact the readers declare, by key. */
    registry(): FactRegistry {
        return Object.fromEntries(this.readers.flatMap((reader) => reader.facts.map((spec) => [spec.key, spec])))
    }
}
