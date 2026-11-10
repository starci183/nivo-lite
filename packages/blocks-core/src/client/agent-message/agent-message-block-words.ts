import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { AgentMessageWords } from "./agent-message-words"

/** The words of the agent message card as the block resolves them from its library keys, in the viewer's language. */
export const messageWordsOf = (words: (text: SpecText) => string): AgentMessageWords => {
    return {
        approve: words({ key: "agentMessageApprove" }),
        edit: words({ key: "agentMessageEdit" }),
        reject: words({ key: "agentMessageReject" }),
        sendEdited: words({ key: "agentMessageSendEdited" }),
        cancel: words({ key: "agentMessageCancel" }),
        why: words({ key: "agentMessageWhy" }),
        evidence: words({ key: "agentMessageEvidence" }),
        rule: words({ key: "agentMessageRule" }),
        openDetail: words({ key: "agentMessageOpenDetail" }),
        openWork: words({ key: "agentMessageOpenWork" }),
        from: words({ key: "agentMessageFrom" }),
        to: words({ key: "agentMessageTo" }),
        via: words({ key: "agentMessageVia" }),
        outboundTo: words({ key: "agentMessageOutboundTo" }),
        editLabel: words({ key: "agentMessageEditLabel" }),
        intents: {
            notify: words({ key: "agentMessageIntentNotify" }),
            report: words({ key: "agentMessageIntentReport" }),
        },
        facts: {
            details: words({ key: "agentMessageFactsDetails" }),
            technical: words({ key: "agentMessageFactsTechnical" }),
        },
        kinds: {
            total: words({ key: "agentMessageTotal" }),
            customer: words({ key: "agentMessageCustomer" }),
            deliver: words({ key: "agentMessageDeliver" }),
            openConnections: words({ key: "agentMessageOpenConnections" }),
        },
        states: {
            waiting: words({ key: "agentMessageWaiting" }),
            approved: words({ key: "agentMessageApproved" }),
            sent: words({ key: "agentMessageSent" }),
            rejected: words({ key: "agentMessageRejected" }),
            failed: words({ key: "agentMessageFailed" }),
            expired: words({ key: "agentMessageExpired" }),
        },
    }
}
