import type { ModuleDef } from "./catalog.types"

/** The video module. */
export const VIDEO = {
    key: "video",
    order: 80,
    icon: "apps",
    glyph: "moduleVideo",
    mascot: "/images/promo/mascot-celebrate.png",
    category: "marketing",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "video",
    workbench: "video",
    settingsExtras: null,
    requires: {
        capabilities: ["video_render"],
        connections: [],
    },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    gates: [
        {
            key: "brand_assets",
        },
        {
            key: "video_goals",
        },
        {
            key: "formats",
        },
        {
            key: "claims_limits",
        },
        {
            key: "approval",
        },
        {
            key: "tone",
        },
    ],
    authorityActions: [
        {
            action: "render_draft",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "publish_video",
            mode: "ask",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: "ask",
            next: [],
        },
    ],
    accepts: [
        {
            command: "render_draft",
            action: "render_draft",
            subjectType: "video_project",
            requiredFields: ["subject_id"],
        },
        {
            command: "publish_video",
            action: "publish_video",
            subjectType: "video_project",
            requiredFields: ["subject_id"],
        },
    ],
} satisfies ModuleDef
