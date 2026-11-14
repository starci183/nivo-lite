import type { ModuleContactBlock } from "@nivo-lite/agent-sdk/module"

/**
 * The Hiring's block on the contact detail: the person's candidate records with this agent (the newest first, the first rows; the
 * candidates page holds the rest), drawn by the generic record list over the Hiring's own read. The host card already is the surface,
 * so the list is plain.
 */
export const HIRING_CONTACT_BLOCKS: ReadonlyArray<ModuleContactBlock> = [
    {
        id: "candidates",
        title: { vi: "\u1ee8ng tuy\u1ec3n", en: "Applications" },
        read: "blocks-core.hiring.api.candidate.of-contact",
        block: {
            id: "core.record-list",
            slot: "rows",
            props: {
                label: { key: "contact_candidates_label" },
                empty: { key: "contact_candidates_empty" },
                idPath: "id",
                titlePath: "name",
                descriptionPath: "screeningSummary",
                badgePath: "stage",
                labels: {
                    stage: {
                        new: { key: "stage_new" },
                        screened: { key: "stage_screened" },
                        interview: { key: "stage_interview" },
                        offer: { key: "stage_offer" },
                        hired: { key: "stage_hired" },
                        rejected: { key: "stage_rejected" },
                    },
                },
                surface: "plain",
            },
        },
    },
]
