/** The chat-activity SSE door takes no options: the app default-deny guards authenticate the stream, the hub is global. */
export type ChatActivitySseOptions = Record<string, never>
