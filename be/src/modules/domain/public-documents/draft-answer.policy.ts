/**
 * The draft answer as the API's STRUCTURED OUTPUT (`AiChatRequest.outputSchema`): one closed object (`additionalProperties: false`),
 * both fields required, NO length bound (the API refuses them). `answers` comes first, so the model decides whether the documents
 * hold the answer before it writes. The answer is still read with `DRAFT_READ_SCHEMA`.
 */
export const DRAFT_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> = {
    type: "object",
    properties: {
        answers: { type: "boolean" },
        body: { type: "string" },
    },
    required: ["answers", "body"],
    additionalProperties: false,
}
