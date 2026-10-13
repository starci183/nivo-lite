import { randomUUID } from "node:crypto"
import type { Ids } from "./ids.port"

/** The production ids: the one place that mints an id from the ambient random source. It has no dependencies, so the DI container builds it without a decorator. */
export class RandomIdsService implements Ids {
    /** A new random UUID (version 4). */
    next(): string {
        return randomUUID()
    }
}
