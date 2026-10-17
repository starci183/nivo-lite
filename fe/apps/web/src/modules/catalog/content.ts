import type { ModuleDef } from "./catalog.types"

/** The content module. */
export const CONTENT = {
    key: "content",
    order: 90,
    icon: "blog",
    glyph: "moduleContent",
    mascot: "/images/promo/mascot-celebrate.png",
    category: "marketing",
    status: "early",
    audience: "internal",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "content",
    workbench: "content",
    settingsExtras: null,
    requires: {
        capabilities: ["social_publish"],
        connections: [],
    },
    connectionProviders: [],
    defaultOperatingMode: "assist",
    multiInstance: false,
    gates: [
        {
            key: "channels",
        },
        {
            key: "audience",
        },
        {
            key: "pillars",
        },
        {
            key: "cadence",
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
            action: "draft_post",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "publish_post",
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
            command: "draft_post",
            action: "draft_post",
            subjectType: "inbound",
            requiredFields: [],
        },
        {
            command: "publish_post",
            action: "publish_post",
            subjectType: "inbound",
            requiredFields: ["subject_id"],
        },
    ],
} satisfies ModuleDef
