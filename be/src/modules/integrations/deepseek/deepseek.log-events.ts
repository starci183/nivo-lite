/** Log events of the prompt library. */
export enum DeepseekLogEvent {
    /** A model answer was not JSON; the next parse or retry follows. */
    NotJson = "deepseek.not_json",
}
