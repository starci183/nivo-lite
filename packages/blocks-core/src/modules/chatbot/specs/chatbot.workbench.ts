import { specDocumentSchema, type SpecDocument } from "@nivo-lite/agent-sdk/spec"
import data from "./chatbot.workbench.json"

/** The seed spec of the Chatbot workbench: the inbox tab, parsed once. */
export const CHATBOT_WORKBENCH_SPEC: SpecDocument = specDocumentSchema.parse(data)
