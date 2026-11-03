import type { ModuleDef } from "./catalog.types"

type ContentShape = {
    key: "content"
    order: number
    icon: string
    glyph: "moduleContent"
    mascot: string
    category: "marketing"
    status: "early"
    audience: "internal"
    includedWithWorkspace: false
    available: true
    knowledgeFolder: string
    workbench: string
    settingsExtras: null
    requires: {
        capabilities: string[]
        connections: never[]
    }
    connectionProviders: never[]
    defaultOperatingMode: "assist"
    multiInstance: false
    gates: {
        key: string
    }[]
    authorityActions: (
        | {
              action: "draft_post"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "publish_post"
              mode: "ask"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: "ask"
              next: never[]
          }
    )[]
    accepts: (
        | {
              command: string
              action: "draft_post"
              subjectType: string
              requiredFields: never[]
          }
        | {
              command: string
              action: "publish_post"
              subjectType: string
              requiredFields: string[]
          }
    )[]
}

/** The content module. */
export const CONTENT: ContentShape = {
    key: "content",
    order: 90,
    icon: "blog",
    glyph: "moduleContent",
    mascot: "/images/agents/content.png",
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
