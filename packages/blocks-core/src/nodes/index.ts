import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"

/** Every core node, React-free so the back end validates graph specs against them without loading React. The node lanes fill it. */
export const coreNodes: ReadonlyArray<NodeDefinition> = []
