import { builder, mock } from "@starci/jest-preset"
import type { ModuleEntry, SendCommandInput, WorkContext, WorkItem } from "@modules/domain/decisions"

/** The workspace context shared by command planner scenarios. */
export const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }
/** The stable sender agent identity for command planner scenarios. */
export const AGENT_ID = "2f5f2c0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"
/** The stable conversation identity used by reply commands. */
export const CONVERSATION_ID = "3f5f2c0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"

const commandOf = builder<ModuleEntry["accepts"][number]>({
    command: "classify_lead",
    action: "classify_lead",
    subjectType: "lead",
    requiredFields: ["lead_id"],
    description: { vi: "phan loai", en: "classify" },
})

const moduleOf = builder<ModuleEntry>({
    key: "sales",
    audience: "internal",
    multiInstance: false,
    name: { vi: "Ban hang", en: "Sales" },
    accepts: [commandOf()],
})

const chatbot = moduleOf({
    key: "chatbot",
    multiInstance: true,
    name: { vi: "Chatbot", en: "Chatbot" },
    accepts: [
        commandOf({
            command: "reply_customer",
            action: "reply_customer",
            subjectType: "conversation",
            requiredFields: [],
            description: { vi: "tra loi", en: "reply" },
        }),
    ],
})

/** The catalogue entries accepted by the command planner fixture. */
export const MODULES: Readonly<Record<string, ModuleEntry>> = { sales: moduleOf(), chatbot }

/** The localized mirror messages used by planner assertions. */
export const TEXTS: Readonly<Record<string, string>> = {
    "command.sender.owner": "Owner",
    "command.sender.inbound": "Customer",
    "command.mirror": "@{{to}} <- {{from}}: {{what}}",
    "command.mirror.subject": "@{{to}} <- {{from}}: {{what}} for {{subject}}",
    "command.subject.order": "order",
    "command.subject.lead": "customer",
}

/** Builds a command addressed to the sales department. */
export const inputOf = builder<SendCommandInput>({
    from: "owner",
    to: "sales",
    command: "classify_lead",
    payload: { subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1" },
    reason: "handoff",
})

/** Builds a reply command addressed to the chatbot department. */
export const replyOf = builder<SendCommandInput>({
    from: "owner",
    to: "chatbot",
    command: "reply_customer",
    payload: { subject_type: "conversation", subject_id: CONVERSATION_ID },
    reason: "handoff",
})

/** Builds the work row passed to a newly inserted command hook. */
export const rowOf = (): WorkItem => mock<WorkItem>({ id: "item-1", lead_id: "lead-1" })

/** Resolves a mirror message with the same fixture catalogue and parameter substitutions. */
export const plannerText = (key: string, params: Readonly<Record<string, string | number>>) =>
    Object.entries(params).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
        TEXTS[key] ?? key,
    )
