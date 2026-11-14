import { Injectable, type OnApplicationBootstrap } from "@nestjs/common"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { QdrantError, QdrantErrorCode } from "./errors/qdrant.error"
import { QdrantClient } from "./qdrant.client"
import { QdrantLogEvent } from "./qdrant.log-events"
import { VECTOR_KINDS } from "./qdrant.policy"

@Injectable()
/**
 * Prepares the collections when the app starts, and again whenever it is asked (the reconcile asks before each run): each collection
 * and its payload indexes are created when missing, which is safe to repeat. Two outcomes are told apart on purpose:
 * - a collection that exists with ANOTHER vector size or distance refuses the start (`QDRANT_MISMATCH`): the app would write vectors
 *   the collection cannot hold, or compare vectors of two sizes;
 * - a service that cannot be reached, or that refuses a call, does NOT stop the app: it is logged, the index reads as down, the
 *   meaning search answers by words, and the next run prepares the collections.
 */
export class QdrantBootService implements OnApplicationBootstrap {
    /** True once every collection was prepared in this process. */
    private prepared = false

    constructor(
        private readonly client: QdrantClient,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Prepares the collections once the app is composed; only a mismatch throws. */
    async onApplicationBootstrap(): Promise<void> {
        await this.prepare()
    }

    /** Prepares the collections when this process has not yet; answers whether they are prepared. Only a mismatch throws. */
    async prepare(): Promise<boolean> {
        if (this.prepared) return true
        try {
            await eachInOrder(VECTOR_KINDS, (kind) => this.client.ensure(kind))
            this.prepared = true
            this.logger.info(QdrantLogEvent.Prepared, { kinds: VECTOR_KINDS.length })
            return true
        } catch (cause) {
            if (cause instanceof QdrantError && cause.code === QdrantErrorCode.Mismatch) throw cause
            this.logger.warn(QdrantLogEvent.Unreachable, { reason: cause instanceof QdrantError ? cause.code : "unknown" })
            return false
        }
    }
}
