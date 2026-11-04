import { LEAD_GEN_COMMANDS } from "./lead-gen-commands"
import { LEAD_GEN_ACTIONS } from "./lead-gen-flow"
import { LEAD_GEN_GATES } from "./lead-gen-gates"
import type { ModuleDef } from "./catalog.types"

type LeadGenShape = {
    key: "lead_gen"
    order: number
    icon: string
    glyph: "moduleLeadGen"
    mascot: string
    category: "sales_customer"
    status: "early"
    audience: "customer"
    includedWithWorkspace: false
    available: true
    knowledgeFolder: string
    workbench: string
    settingsExtras: null
    requires: {
        capabilities: never[]
        connections: string[]
    }
    connectionProviders: string[]
    defaultOperatingMode: "assist"
    multiInstance: true
    gates: {
        key: string
    }[]
    authorityActions: (
        | {
              action: "capture_lead"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "greet_prospect"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "ask_qualifying"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "score_lead"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "reply_comment_public"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "private_reply_comment"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "send_lead_offer"
              mode: "ask"
              limitVnd: null
              requiredFields: string[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "quote_custom_price"
              mode: "ask"
              limitVnd: null
              requiredFields: string[]
              amountLimit: true
              maxMode: null
              next: never[]
          }
        | {
              action: "handoff_to_sales"
              mode: "auto"
              limitVnd: null
              requiredFields: string[]
              amountLimit: false
              maxMode: null
              next: "classify_lead"[]
          }
        | {
              action: "follow_up_lead"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "close_lead"
              mode: "auto"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: null
              next: never[]
          }
        | {
              action: "message_with_human_agent_tag"
              mode: "ask"
              limitVnd: null
              requiredFields: string[]
              amountLimit: false
              maxMode: "ask"
              next: never[]
          }
        | {
              action: "message_outside_window"
              mode: "never"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: "never"
              next: never[]
          }
        | {
              action: "hide_or_delete_comment"
              mode: "never"
              limitVnd: null
              requiredFields: never[]
              amountLimit: false
              maxMode: "never"
              next: never[]
          }
    )[]
    accepts: (
        | {
              command: string
              action: "capture_lead"
              subjectType: string
              requiredFields: never[]
          }
        | {
              command: string
              action: "greet_prospect"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "ask_qualifying"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "score_lead"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "reply_comment_public"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "private_reply_comment"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "send_lead_offer"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "quote_custom_price"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "handoff_to_sales"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "follow_up_lead"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "close_lead"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "message_with_human_agent_tag"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "message_outside_window"
              subjectType: string
              requiredFields: string[]
          }
        | {
              command: string
              action: "hide_or_delete_comment"
              subjectType: string
              requiredFields: string[]
          }
    )[]
}

/** The lead_gen module. */
export const LEAD_GEN: LeadGenShape = {
    key: "lead_gen",
    order: 15,
    icon: "community",
    glyph: "moduleLeadGen",
    mascot: "/images/agents/lead_gen.png",
    category: "sales_customer",
    status: "early",
    audience: "customer",
    includedWithWorkspace: false,
    available: true,
    knowledgeFolder: "lead_gen",
    workbench: "lead_gen",
    settingsExtras: null,
    requires: {
        capabilities: [],
        connections: ["meta"],
    },
    connectionProviders: ["meta"],
    defaultOperatingMode: "assist",
    multiInstance: true,
    gates: LEAD_GEN_GATES,
    authorityActions: LEAD_GEN_ACTIONS,
    accepts: LEAD_GEN_COMMANDS,
} satisfies ModuleDef
