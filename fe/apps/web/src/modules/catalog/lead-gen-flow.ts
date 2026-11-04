import type { RegistryAction } from "./catalog.types"

type LeadGenActionsShape = (
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

/** The authority actions of the lead generation module. */
export const LEAD_GEN_ACTIONS: LeadGenActionsShape = [
    {
        action: "capture_lead",
        mode: "auto",
        limitVnd: null,
        requiredFields: [],
        amountLimit: false,
        maxMode: null,
        next: [],
    },
    {
        action: "greet_prospect",
        mode: "auto",
        limitVnd: null,
        requiredFields: [],
        amountLimit: false,
        maxMode: null,
        next: [],
    },
    {
        action: "ask_qualifying",
        mode: "auto",
        limitVnd: null,
        requiredFields: [],
        amountLimit: false,
        maxMode: null,
        next: [],
    },
    {
        action: "score_lead",
        mode: "auto",
        limitVnd: null,
        requiredFields: [],
        amountLimit: false,
        maxMode: null,
        next: [],
    },
    {
        action: "reply_comment_public",
        mode: "auto",
        limitVnd: null,
        requiredFields: [],
        amountLimit: false,
        maxMode: null,
        next: [],
    },
    {
        action: "private_reply_comment",
        mode: "auto",
        limitVnd: null,
        requiredFields: [],
        amountLimit: false,
        maxMode: null,
        next: [],
    },
    {
        action: "send_lead_offer",
        mode: "ask",
        limitVnd: null,
        requiredFields: ["contact"],
        amountLimit: false,
        maxMode: null,
        next: [],
    },
    {
        action: "quote_custom_price",
        mode: "ask",
        limitVnd: null,
        requiredFields: ["amount_vnd"],
        amountLimit: true,
        maxMode: null,
        next: [],
    },
    {
        action: "handoff_to_sales",
        mode: "auto",
        limitVnd: null,
        requiredFields: ["contact", "need"],
        amountLimit: false,
        maxMode: null,
        next: ["classify_lead"],
    },
    {
        action: "follow_up_lead",
        mode: "auto",
        limitVnd: null,
        requiredFields: [],
        amountLimit: false,
        maxMode: null,
        next: [],
    },
    {
        action: "close_lead",
        mode: "auto",
        limitVnd: null,
        requiredFields: [],
        amountLimit: false,
        maxMode: null,
        next: [],
    },
    {
        action: "message_with_human_agent_tag",
        mode: "ask",
        limitVnd: null,
        requiredFields: ["contact"],
        amountLimit: false,
        maxMode: "ask",
        next: [],
    },
    {
        action: "message_outside_window",
        mode: "never",
        limitVnd: null,
        requiredFields: [],
        amountLimit: false,
        maxMode: "never",
        next: [],
    },
    {
        action: "hide_or_delete_comment",
        mode: "never",
        limitVnd: null,
        requiredFields: [],
        amountLimit: false,
        maxMode: "never",
        next: [],
    },
] satisfies ReadonlyArray<RegistryAction>
