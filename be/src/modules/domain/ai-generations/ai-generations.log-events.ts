/** Log events of the ai-generations capability. */
export enum AiGenerationsLogEvent {
    /** A generation failed; the cause rides along. */
    GenerationFailed = "ai_generations.generation_failed",
    /** A generation row ended in error on the engine side. */
    GenerationErrored = "ai_generations.generation_errored",
}
