/** Log events of the ai-generations capability. */
export enum AiGenerationsLogEvent {
    /** A generation failed; the cause rides along. */
    GenerationFailed = "ai_generations.generation_failed",
    /** The AI endpoint gave a generation no answer (a failed call, an empty text or the deadline). */
    GenerationUnanswered = "ai_generations.generation_unanswered",
    /** A generation row ended in error on the engine side. */
    GenerationErrored = "ai_generations.generation_errored",
}
