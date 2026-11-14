import type { AgentMessageWords } from "@/modules/plugin-registry/client"
import type { TeamChatMessagesCopy } from "@/modules/types"

/** The shared words of the message card, from the words of the thread. */
export const agentMessageWordsOf = (copy: TeamChatMessagesCopy): AgentMessageWords => ({
    approve: copy.approve,
    edit: "",
    reject: copy.refuse,
    sendEdited: "",
    cancel: "",
    why: "",
    evidence: "",
    rule: "",
    openDetail: copy.relatedWork,
    openWork: "",
    from: copy.agentFrom,
    to: "",
    via: "",
    outboundTo: "",
    editLabel: "",
    states: {
        waiting: copy.approvalPending,
        approved: copy.approvalApproved,
        sent: copy.approvalApproved,
        rejected: copy.approvalRefused,
        failed: copy.approvalRefused,
        expired: copy.approvalExpired,
    },
    intents: { notify: copy.intentNotify, report: copy.report },
    facts: { details: copy.approvalRows.details, technical: copy.approvalRows.technical },
    approval: {
        step: copy.approvalRows.step,
        account: copy.approvalRows.account,
        tool: copy.approvalRows.tool,
        node: copy.approvalRows.node,
        locale: copy.approvalRows.locale,
    },
    kinds: {
        total: copy.orderTotal,
        customer: copy.orderCustomer,
        deliver: copy.orderDeliver,
        openConnections: copy.openConnections,
    },
})
