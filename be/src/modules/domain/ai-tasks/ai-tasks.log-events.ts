/** Log events of the prompt library. */
export enum AiTasksLogEvent {
    /** A model answer was not JSON; the next parse or retry follows. */
    NotJson = "ai_tasks.not_json",
    /** Some pictures of a model call could not be inlined (unreadable, not a picture, too large) and were left out. */
    ImagesDropped = "ai_tasks.images_dropped",
    /** One picture of a model call could not be read from the store (network failure or timeout); it is left out. */
    ImageUnreadable = "ai_tasks.image_unreadable",
    /** A call with pictures ran on the fallback path, which reads no pictures; the model was told it cannot see them. */
    ImagesUnsupported = "ai_tasks.images_unsupported",
}
