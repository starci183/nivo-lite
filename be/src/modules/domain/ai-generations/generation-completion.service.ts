import { Injectable } from "@nestjs/common"
import type { GenerationCompletion } from "./ai-generations.port"

@Injectable()
/** Default for applications that consume generated text directly. */
export class GenerationCompletionService implements GenerationCompletion {
    /** No additional domain effect is required for generic generated text. */
    completeGeneration(): Promise<void> {
        return Promise.resolve()
    }
}
