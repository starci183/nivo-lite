import type { Type } from "@nestjs/common"
import { BrainPolicyDerivationsService } from "./brain-policy-derivations.service"
import { FactEmbeddingsService } from "./fact-embeddings.service"
import { ModelJsonService } from "./model-json.service"

/**
 * What the derivations mode of an app that writes facts but runs no pass provides: the policy derivations always (a fact change there
 * queues a derive pass for the api's worker); with `vectors`, the vectors listener of the facts too, so a fact put in force there gets
 * its vector at once. Only an app with the AI endpoint and the usage meter asks for the vectors (the mcp); the cli does not, and the
 * api's timed sweep gives its facts their vectors.
 */
export const derivationsProvidersOf = (vectors: boolean): ReadonlyArray<Type> =>
    vectors ? [BrainPolicyDerivationsService, FactEmbeddingsService, ModelJsonService] : [BrainPolicyDerivationsService]
