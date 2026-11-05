import { NodeVocabulary } from "@nivo-lite/agent-sdk/node/vocabulary"

/** The vocabulary of this process: the schema of a graph reads it on every parse, and the plug-ins register into it at start. */
export const graphVocabulary: NodeVocabulary = new NodeVocabulary()
