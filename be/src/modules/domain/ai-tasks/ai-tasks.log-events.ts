/** Log events of the prompt library. */
export enum AiTasksLogEvent {
    /** A model answer was not JSON; the next parse or retry follows. */
    NotJson = "ai_tasks.not_json",
    /** The AI endpoint gave a call no answer (a timeout, a failure, an empty text); the same call is made once more. */
    Retried = "ai_tasks.retried",
    /** Some pictures of a model call could not be inlined (unreadable, not a picture, too large) and were left out. */
    ImagesDropped = "ai_tasks.images_dropped",
    /** One picture of a model call could not be read from the store (network failure or timeout); it is left out. */
    ImageUnreadable = "ai_tasks.image_unreadable",
}
