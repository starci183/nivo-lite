import { installed } from "@nivo-lite/plugin-registry"
import type { PluginToolLabel } from "@nivo-lite/agent-sdk/installation"

// The composition root of this app for the plugin registry, SERVER-SAFE (no React): the installation, the graph views, the fixtures and
// the words of the installed plugins. Server files read from here; the renderers of the blocks and the card components are in the
// client root `./client`, imported only by client files, so no server file drags a React context into the server graph.
export { installed }
export * from "@nivo-lite/plugin-registry/kit"

/** The owner-facing words of an installed tool, or null when no installed plugin declares one. */
export const toolLabelOf = (tool: string): PluginToolLabel | null =>
    Object.hasOwn(installed.toolLabels, tool) ? (installed.toolLabels[tool] ?? null) : null
