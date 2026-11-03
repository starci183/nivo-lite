import type { ModuleDef } from "./catalog.types"

type ChatbotShape = {
    key: "chatbot"
    order: number
    icon: string
    glyph: "moduleChatbot"
    mascot: string
    category: "sales_customer"
    status: "stable"
    audience: "customer"
    includedWithWorkspace: false
    available: true
    knowledgeFolder: string
    workbench: string
    settingsExtras: string
    requires: {
        capabilities: string[]
        connections: never[]
    }
    connectionProviders: string[]
    defaultOperatingMode: "assist"
    multiInstance: true
    gates: {
        key: string
    }[]
    authorityActions: (
        | {
              action: "reply_customer"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "handoff_lead"
              mode: "auto"
              limitVnd: null
              requiredFields: string[]
              amountLimit: false
              maxMode: null
              next: "classify_lead"[]
          }
    )[]
    accepts: (
        | {
              command: string
              action: "reply_customer"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "handoff_lead"
              subjectType: string
              requiredFields: string[]
          }
    )[]
}

/** The chatbot module. */
export const CHATBOT: ChatbotShape = {
    key: "chatbot",
    order: 10,
    icon: "support",
    glyph: "moduleChatbot",
    mascot: "/images/agents/chatbot.png",
    category: "sales_customer",
    status: "stable",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "chatbot",
    workbench: "chatbot",
    settingsExtras: "chatbot_reply",
    requires: {
        capabilities: ["customer_chat"],
        connections: [],
    },
    connectionProviders: ["telegram", "zalo_oa", "meta"],
    defaultOperatingMode: "assist",
    multiInstance: true,
    gates: [
        {
            key: "identity",
        },
        {
            key: "products",
        },
        {
            key: "support_scope",
        },
        {
            key: "channels",
        },
        {
            key: "hours_sla",
        },
        {
            key: "handoff",
        },
        {
            key: "prohibited",
        },
        {
            key: "tone",
        },
    ],
    authorityActions: [
        {
            action: "reply_customer",
            mode: "auto",
            limitVnd: null,
            requiredFields: [],
            amountLimit: false,
            maxMode: null,
            next: [],
        },
        {
            action: "handoff_lead",
            mode: "auto",
            limitVnd: null,
            requiredFields: ["contact_name", "need"],
            amountLimit: false,
            maxMode: null,
            next: ["classify_lead"],
        },
    ],
    accepts: [
        {
            command: "reply_customer",
            action: "reply_customer",
            subjectType: "conversation",
            requiredFields: ["subject_id"],
        },
        {
            command: "handoff_lead",
            action: "handoff_lead",
            subjectType: "conversation",
            requiredFields: ["subject_id"],
        },
    ],
} satisfies ModuleDef
