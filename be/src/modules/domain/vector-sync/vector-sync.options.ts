import type { InjectionToken } from "@nestjs/common"

/** What the vector-sync capability needs from the composition root. */
export interface VectorSyncOptions {
    /** The provider of the embedding door (a `VectorEmbedder`): the knowledge capability's metered, credit-checked one. */
    readonly embedder: InjectionToken
    /** The provider of the drift report (a `VectorDriftReporter`): the team chat notices in the api; absent where no chat is composed. */
    readonly driftReporter?: InjectionToken
}
