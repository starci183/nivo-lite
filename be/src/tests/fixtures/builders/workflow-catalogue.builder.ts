import type { WorkflowTemplate, WorkflowTemplateVersion } from "@nivo-lite/blocks-core/modules"

/** The group the first step of a template's older version sits in: the one thing its newest version changed. */
const OLDER_GROUP = "before"

const newestOf = (template: WorkflowTemplate): WorkflowTemplateVersion =>
    template.versions.reduce((newest, version) => (version.version > newest.version ? version : newest))

/**
 * A shipped template as a catalogue that still held the version before its newest: that older version (newest - 1) is the newest
 * graph with its FIRST step in the group `OLDER_GROUP`, so the newest version changed exactly one step. Every shipped template holds
 * one version, and what the policies do with a newer template version (the offer, the closest version, the wire) needs two. A value
 * only: the catalogue the services read is never replaced, so it reaches the policies that take a template, not the services.
 */
export const withOlderVersion = (template: WorkflowTemplate): WorkflowTemplate => {
    const newest = newestOf(template)
    const older: WorkflowTemplateVersion = {
        version: newest.version - 1,
        publishedAt: "2026-11-01T00:00:00.000Z",
        changes: newest.changes,
        graph: {
            ...newest.graph,
            nodes: newest.graph.nodes.map((node, at) => (at === 0 ? { ...node, group: OLDER_GROUP } : node)),
        },
    }
    return { ...template, versions: [older, newest] }
}
