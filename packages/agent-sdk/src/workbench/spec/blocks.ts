import type { WorkbenchBlockDefinition } from "./spec.types"

/** The gap roles a spec may name on a stack; the Grammar resolves each to its step. */
const GAPS: ReadonlyArray<string> = ["identity", "inline", "row", "section", "region"]

/**
 * The blocks of the SDK a spec may compose, as data the validator and the composer read. Each one is drawn by one SDK renderer built
 * only from Grammar components; a module adds its own reviewed blocks beside these under names of its own.
 */
export const SDK_SPEC_BLOCKS: ReadonlyArray<WorkbenchBlockDefinition> = [
    {
        name: "stack",
        props: { gap: { type: "string", required: true, oneOf: GAPS } },
        slots: {},
        children: true,
    },
    {
        name: "card-grid",
        props: {},
        slots: {},
        children: true,
    },
    {
        name: "section",
        props: { title: { type: "text", required: true }, hint: { type: "text", required: false } },
        slots: {},
        children: true,
    },
    {
        name: "figures",
        props: { label: { type: "text", required: true } },
        slots: { data: { kind: "read", shape: "record", required: true } },
        children: true,
    },
    {
        name: "figure",
        props: { term: { type: "text", required: true }, path: { type: "string", required: true } },
        slots: {},
        children: false,
    },
    {
        name: "detail",
        props: { label: { type: "text", required: true } },
        slots: { data: { kind: "read", shape: "record", required: true } },
        children: true,
    },
    {
        name: "fact",
        props: { term: { type: "text", required: true }, path: { type: "string", required: true } },
        slots: {},
        children: false,
    },
    {
        name: "record-list",
        props: {
            label: { type: "text", required: true },
            empty: { type: "text", required: true },
            idPath: { type: "string", required: true },
            titlePath: { type: "string", required: true },
            descriptionPath: { type: "string", required: false },
            badgePath: { type: "string", required: false },
        },
        slots: { rows: { kind: "read", shape: "list", required: true }, open: { kind: "action", required: false } },
        children: false,
    },
    {
        name: "waiting",
        props: {},
        slots: {},
        children: false,
    },
    {
        name: "dashboard-cards",
        props: {},
        slots: {},
        children: false,
    },
]
