import type { ModuleDef } from "./catalog.types"

/** The setup gates of the lead generation module. */
export const LEAD_GEN_GATES = [
    {
        key: "icp_area",
    },
    {
        key: "public_offers",
    },
    {
        key: "qualification",
    },
    {
        key: "objections",
    },
    {
        key: "forbidden_claims",
    },
    {
        key: "hours_owner",
    },
    {
        key: "tone",
    },
    {
        key: "channels_posts",
    },
] satisfies ModuleDef["gates"]
