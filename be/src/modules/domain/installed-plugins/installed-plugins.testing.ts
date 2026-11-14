import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf, type NodeIndex } from "@nivo-lite/agent-sdk/node"
import { latestTemplateVersion, type WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import { INSTALLED } from "./installed.policy"

/**
 * Spec support (never imported by production): what the specs read of the installation since the package flip, from the one source
 * production reads it from. Before the flip a spec indexed `coreNodes` (every core step a `defineNode` node) and read the shipped
 * template JSON (`WORKFLOW_TEMPLATES`); now the core package installs its control steps as `defineNode` nodes and every business step
 * as a template node, and every template comes from a template agent's graph (`INSTALLED.templates()`).
 */

/** The installation's node index: its control nodes (`defineNode`), effects, tools (the engine's native ones too) and data kinds; template nodes are looked up by id. */
export const coreNodeIndex = (): NodeIndex => nodeIndexOf(INSTALLED.nodeInstall())

/** The core package's workflow templates (since the flip, its template agents' graphs), as `WORKFLOW_TEMPLATES` listed them before it. */
export const coreTemplates = (): ReadonlyArray<WorkflowTemplate> =>
    INSTALLED.templates().filter((template) => INSTALLED.pluginOfModule(template.moduleKey)?.key === "core")

/** The installed workflow template of an id; a spec that names one the installation lacks fails here, with the id. */
export const installedTemplateOf = (id: string): WorkflowTemplate => {
    const template = INSTALLED.templateOf(id)
    if (template === null) throw new Error(`no installed workflow template ${id}`)
    return template
}

/** The graph of the newest version of an installed workflow template, as the engine reads it (`nivo/agent-graph@1`). */
export const latestGraphOf = (id: string): GraphSpec => latestTemplateVersion(installedTemplateOf(id)).graph
