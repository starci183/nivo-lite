import type { MessagePaths, ProposalPaths } from "./conversation.types"

/** The fields of a line of `chatbot.messages`: the inbox reads the thread through them, no spec names them. */
export const THREAD_LINE_FIELDS: MessagePaths = {
    idPath: "id",
    textPath: "text",
    authorPath: "who",
    timePath: "at",
    statusPath: "state",
    sidePath: "side",
    markPath: "mark",
    filesPath: "files",
    orderPath: "order",
}

/** The fields of the record of `chatbot.proposals`: the reply the AI proposed, with what the customer asked. */
export const PROPOSAL_FIELDS: ProposalPaths = {
    idPath: "id",
    textPath: "text",
    askedPath: "asked",
    notePath: "note",
}

/** The fields of the record of `chatbot.thread` that head the thread and fill the contact pane. */
export const THREAD_FIELDS = {
    id: "id",
    name: "name",
    channelName: "channelName",
    avatarUrl: "avatarUrl",
    handledBy: "handledBy",
    stage: "stage",
    need: "need",
    phone: "phone",
    leadId: "leadId",
} as const
