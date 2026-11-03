import type { RegistryAction, RegistryCommand } from "./catalog.types"

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

type LeadGenCommandsShape = (
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

/** The commands the lead generation module accepts. */
export const LEAD_GEN_COMMANDS: LeadGenCommandsShape = [
    {
        command: "capture_lead",
        action: "capture_lead",
        subjectType: "inbound",
        requiredFields: [],
    },
    {
        command: "greet_prospect",
        action: "greet_prospect",
        subjectType: "lead",
        requiredFields: ["lead_id"],
    },
    {
        command: "ask_qualifying",
        action: "ask_qualifying",
        subjectType: "lead",
        requiredFields: ["lead_id"],
    },
    {
        command: "score_lead",
        action: "score_lead",
        subjectType: "lead",
        requiredFields: ["lead_id"],
    },
    {
        command: "reply_comment_public",
        action: "reply_comment_public",
        subjectType: "inbound",
        requiredFields: ["subject_id"],
    },
    {
        command: "private_reply_comment",
        action: "private_reply_comment",
        subjectType: "inbound",
        requiredFields: ["subject_id"],
    },
    {
        command: "send_lead_offer",
        action: "send_lead_offer",
        subjectType: "lead",
        requiredFields: ["lead_id"],
    },
    {
        command: "quote_custom_price",
        action: "quote_custom_price",
        subjectType: "lead",
        requiredFields: ["lead_id"],
    },
    {
        command: "handoff_to_sales",
        action: "handoff_to_sales",
        subjectType: "lead",
        requiredFields: ["lead_id"],
    },
    {
        command: "follow_up_lead",
        action: "follow_up_lead",
        subjectType: "lead",
        requiredFields: ["lead_id"],
    },
    {
        command: "close_lead",
        action: "close_lead",
        subjectType: "lead",
        requiredFields: ["lead_id"],
    },
    {
        command: "message_with_human_agent_tag",
        action: "message_with_human_agent_tag",
        subjectType: "lead",
        requiredFields: ["lead_id"],
    },
    {
        command: "message_outside_window",
        action: "message_outside_window",
        subjectType: "lead",
        requiredFields: ["lead_id"],
    },
    {
        command: "hide_or_delete_comment",
        action: "hide_or_delete_comment",
        subjectType: "inbound",
        requiredFields: ["subject_id"],
    },
] satisfies ReadonlyArray<RegistryCommand>
