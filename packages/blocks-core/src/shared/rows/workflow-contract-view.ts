import {
    contractViewsOf,
    type ContractProblem,
    type ContractType,
    type ContractViews,
    type ContractWords,
    type EntryOpenTo,
    type TriggerCondition,
    type TriggerSourceKind,
} from "@nivo-lite/agent-sdk/graph"
import { bilingualOf, messageOf } from "../messages/catalog"
import type { NodeLocale } from "../nodes/node-schema.types"

/*
 * The contract parts of a workflow as the editor, the graph canvas and the agent Graph page draw them, in words. The structure is NIVO
 * core (`contractViewsOf` in `@nivo-lite/agent-sdk/graph`); the words live in this package's catalog (`messages/vi.json`,
 * `messages/en.json`, keys `contract*`), bound here to that structure for the web and the tests of this package.
 */

export type {
    BindingView,
    CallEdgeView,
    CallView,
    EntryView,
    OutcomeEndView,
    OutcomeView,
    ParamChipView,
    TriggerConditionView,
    TriggerView,
} from "@nivo-lite/agent-sdk/graph"
export { callEdgesOf } from "@nivo-lite/agent-sdk/graph"

type Words = Readonly<Record<NodeLocale, string>>

/** The words of each trigger source kind. */
export const TRIGGER_SOURCE_LABELS: Readonly<Record<TriggerSourceKind, Words>> = {
    zalo: bilingualOf("contractSourceZalo"),
    telegram: bilingualOf("contractSourceTelegram"),
    facebook: bilingualOf("contractSourceFacebook"),
    instagram: bilingualOf("contractSourceInstagram"),
    website: bilingualOf("contractSourceWebsite"),
    sepay: bilingualOf("contractSourceSepay"),
    timer: bilingualOf("contractSourceTimer"),
    schedule: bilingualOf("contractSourceSchedule"),
    "chats-group": bilingualOf("contractSourceChatsGroup"),
    workflow: bilingualOf("contractSourceWorkflow"),
    provider: bilingualOf("contractSourceProvider"),
}

/** The words of each entry rule. */
export const ENTRY_LABELS: Readonly<Record<EntryOpenTo, Words>> = {
    any: bilingualOf("contractEntryAny"),
    agent: bilingualOf("contractEntryAgent"),
}

/** The words of each contract type. */
export const CONTRACT_TYPE_LABELS: Readonly<Record<ContractType, Words>> = {
    string: bilingualOf("contractTypeString"),
    number: bilingualOf("contractTypeNumber"),
    integer: bilingualOf("contractTypeInteger"),
    boolean: bilingualOf("contractTypeBoolean"),
    object: bilingualOf("contractTypeObject"),
    array: bilingualOf("contractTypeArray"),
}

/** The words of each agent a hand-off may call, by module key. */
export const AGENT_LABELS: Readonly<Record<string, Words>> = {
    sales: bilingualOf("contractAgentSales"),
    accounting: bilingualOf("contractAgentAccounting"),
    chatbot: bilingualOf("contractAgentChatbot"),
}

/** The words of the params the seeded workflows name; a param without words shows its name. */
export const PARAM_LABELS: Readonly<Record<string, Words>> = {
    leadId: bilingualOf("contractParamLeadId"),
    conversationId: bilingualOf("contractParamConversationId"),
    text: bilingualOf("contractParamText"),
    channel: bilingualOf("contractParamChannel"),
    messages: bilingualOf("contractParamMessages"),
    messageIds: bilingualOf("contractParamMessageIds"),
    items: bilingualOf("contractParamItems"),
    address: bilingualOf("contractParamAddress"),
    occasion: bilingualOf("contractParamOccasion"),
    orderId: bilingualOf("contractParamOrderId"),
    claimId: bilingualOf("contractParamClaimId"),
    transactionId: bilingualOf("contractParamTransactionId"),
    slotMs: bilingualOf("contractParamSlotMs"),
    careKind: bilingualOf("contractParamCareKind"),
    ref: bilingualOf("contractParamRef"),
    suffix: bilingualOf("contractParamSuffix"),
    dueAt: bilingualOf("contractParamDueAt"),
    request: bilingualOf("contractParamRequest"),
    contact: bilingualOf("contractParamContact"),
    summary: bilingualOf("contractParamSummary"),
    reason: bilingualOf("contractParamReason"),
    lastAskedAt: bilingualOf("contractParamLastAskedAt"),
    actorMemberId: bilingualOf("contractParamActorMemberId"),
    deliveryAt: bilingualOf("contractParamDeliveryAt"),
    name: bilingualOf("contractParamName"),
    phone: bilingualOf("contractParamPhone"),
    email: bilingualOf("contractParamEmail"),
    recipientName: bilingualOf("contractParamRecipientName"),
    recipientPhone: bilingualOf("contractParamRecipientPhone"),
    lastOrderId: bilingualOf("contractParamLastOrderId"),
    lastOrderCode: bilingualOf("contractParamLastOrderCode"),
    lastPaymentId: bilingualOf("contractParamLastPaymentId"),
    facts: bilingualOf("contractParamFacts"),
    images: bilingualOf("contractParamImages"),
    missing: bilingualOf("contractParamMissing"),
    reply: bilingualOf("contractParamReply"),
    stage: bilingualOf("contractParamStage"),
    branch: bilingualOf("contractParamBranch"),
    amountVnd: bilingualOf("contractParamAmountVnd"),
    intents: bilingualOf("contractParamIntents"),
    lines: bilingualOf("contractParamLines"),
    grounded: bilingualOf("contractParamGrounded"),
    draft: bilingualOf("contractParamDraft"),
    result: bilingualOf("contractParamResult"),
    status: bilingualOf("contractParamStatus"),
    tag: bilingualOf("contractParamTag"),
    values: bilingualOf("contractParamValues"),
    outcome: bilingualOf("contractParamOutcome"),
    order: bilingualOf("contractParamOrder"),
    complaint: bilingualOf("contractParamComplaint"),
    paymentClaim: bilingualOf("contractParamPaymentClaim"),
    payerName: bilingualOf("contractParamPayerName"),
    claim: bilingualOf("contractParamClaim"),
    attachment: bilingualOf("contractParamAttachment"),
    count: bilingualOf("contractParamCount"),
    issue: bilingualOf("contractParamIssue"),
    orderNumber: bilingualOf("contractParamOrderNumber"),
    content: bilingualOf("contractParamContent"),
    qrUrl: bilingualOf("contractParamQrUrl"),
    arrival: bilingualOf("contractParamArrival"),
    evidenced: bilingualOf("contractParamEvidenced"),
    candidateIds: bilingualOf("contractParamCandidateIds"),
    reasons: bilingualOf("contractParamReasons"),
    sent: bilingualOf("contractParamSent"),
    posted: bilingualOf("contractParamPosted"),
    id: bilingualOf("contractParamId"),
    kind: bilingualOf("contractParamKind"),
    existingOrderId: bilingualOf("contractParamExistingOrderId"),
    note: bilingualOf("contractParamNote"),
    question: bilingualOf("contractParamQuestion"),
    thread: bilingualOf("contractParamThread"),
    history: bilingualOf("contractParamHistory"),
    body: bilingualOf("contractParamBody"),
    payload: bilingualOf("contractParamPayload"),
    claimKind: bilingualOf("contractParamClaimKind"),
    contactId: bilingualOf("contractParamContactId"),
    recentLines: bilingualOf("contractParamRecentLines"),
    since: bilingualOf("contractParamSince"),
    orderNo: bilingualOf("contractParamOrderNo"),
    roomId: bilingualOf("contractParamRoomId"),
    messageId: bilingualOf("contractParamMessageId"),
    replyTo: bilingualOf("contractParamReplyTo"),
    room: bilingualOf("contractParamRoom"),
    intent: bilingualOf("contractParamIntent"),
    asker: bilingualOf("contractParamAsker"),
    locale: bilingualOf("contractParamLocale"),
    bookingId: bilingualOf("contractParamBookingId"),
    postId: bilingualOf("contractParamPostId"),
    planned: bilingualOf("contractParamPlanned"),
    candidateId: bilingualOf("contractParamCandidateId"),
    projectId: bilingualOf("contractParamProjectId"),
    awaiting: bilingualOf("contractParamAwaiting"),
    reminded: bilingualOf("contractParamReminded"),
    refused: bilingualOf("contractParamRefused"),
    direction: bilingualOf("contractParamDirection"),
    // The settings of a hand-off and of an outcome end, as their cards list them.
    agent: bilingualOf("contractParamAgent"),
    workflow: bilingualOf("contractParamWorkflow"),
    version: bilingualOf("contractParamVersion"),
    inputs: bilingualOf("contractParamInputs"),
    outputs: bilingualOf("contractParamOutputs"),
}

const CONDITION_WORDS: Readonly<Record<TriggerCondition["op"], Words>> = {
    equals: bilingualOf("contractConditionEquals"),
    "not-equals": bilingualOf("contractConditionNotEquals"),
    in: bilingualOf("contractConditionIn"),
    contains: bilingualOf("contractConditionContains"),
    present: bilingualOf("contractConditionPresent"),
}

/** The words of each contract problem, Vietnamese first, filled with where it is. */
const CONTRACT_WORDS: Readonly<Record<ContractProblem["code"], Words>> = {
    TRIGGER_INPUT_UNSUPPLIED: bilingualOf("contractProblemTriggerInputUnsupplied"),
    TRIGGER_INPUT_TYPE: bilingualOf("contractProblemTriggerInputType"),
    TRIGGER_CONNECTION_INVALID: bilingualOf("contractProblemTriggerConnectionInvalid"),
    TRIGGER_CONDITION_UNKNOWN: bilingualOf("contractProblemTriggerConditionUnknown"),
    TRIGGER_PROVIDER_UNNAMED: bilingualOf("contractProblemTriggerProviderUnnamed"),
    TRIGGER_PROVIDER_UNKNOWN: bilingualOf("contractProblemTriggerProviderUnknown"),
    TRIGGER_FILTER_INVALID: bilingualOf("contractProblemTriggerFilterInvalid"),
    TRIGGER_KEY_DUPLICATE: bilingualOf("contractProblemTriggerKeyDuplicate"),
    CONTRACT_INPUT_DUPLICATE: bilingualOf("contractProblemContractInputDuplicate"),
    CALL_TARGET_UNKNOWN: bilingualOf("contractProblemCallTargetUnknown"),
    CALL_VERSION_UNKNOWN: bilingualOf("contractProblemCallVersionUnknown"),
    CALL_INPUT_MISSING: bilingualOf("contractProblemCallInputMissing"),
    CALL_INPUT_UNKNOWN: bilingualOf("contractProblemCallInputUnknown"),
    CALL_INPUT_TYPE: bilingualOf("contractProblemCallInputType"),
    CALL_ENTRY_CLOSED: bilingualOf("contractProblemCallEntryClosed"),
    OUTCOME_DUPLICATE: bilingualOf("contractProblemOutcomeDuplicate"),
    OUTCOME_UNKNOWN: bilingualOf("contractProblemOutcomeUnknown"),
    OUTCOME_OUTPUT_MISSING: bilingualOf("contractProblemOutcomeOutputMissing"),
    OUTCOME_OUTPUT_UNKNOWN: bilingualOf("contractProblemOutcomeOutputUnknown"),
    OUTCOME_OUTPUT_TYPE: bilingualOf("contractProblemOutcomeOutputType"),
}

const words: ContractWords = {
    sourceLabel: (kind, locale) => TRIGGER_SOURCE_LABELS[kind][locale],
    entryLabel: (openTo, locale) => ENTRY_LABELS[openTo][locale],
    typeLabel: (type, locale) => CONTRACT_TYPE_LABELS[type][locale],
    conditionWord: (op, locale) => CONDITION_WORDS[op][locale],
    paramLabel: (name, locale) => PARAM_LABELS[name]?.[locale],
    pathSeparator: (locale) => messageOf(locale, "contractParamPathSeparator"),
    versionLatest: (locale) => messageOf(locale, "contractVersionLatest"),
    versionPinned: (locale) => messageOf(locale, "contractVersionPinned"),
    problem: (code, locale) => CONTRACT_WORDS[code][locale],
    agentLabel: (agent, locale) => AGENT_LABELS[agent]?.[locale],
}

const views = contractViewsOf(words)

/** The words of a param, its name when it has none; a dotted path is worded member by member (`paymentClaim.amountVnd`). */
export const paramLabelOf = (name: string, locale: NodeLocale): string => views.paramLabelOf(name, locale)

/** One binding as a chip (a ref) or a plain value. */
export const bindingViewOf: ContractViews["bindingViewOf"] = views.bindingViewOf

/** Every binding of a record, in its order. */
export const bindingViewsOf: ContractViews["bindingViewsOf"] = views.bindingViewsOf

/** The triggers of a workflow; empty for a graph from before contracts. */
export const triggerViewsOf: ContractViews["triggerViewsOf"] = views.triggerViewsOf

/** The outcomes of a workflow. */
export const outcomeViewsOf: ContractViews["outcomeViewsOf"] = views.outcomeViewsOf

/** The entry rule of a workflow, open to any caller when it names none. */
export const entryViewOf: ContractViews["entryViewOf"] = views.entryViewOf

/** The hand-off of an end node, or null for any other node. `names` gives the target workflows' names by `<agent>.<workflow>`. */
export const callViewOf: ContractViews["callViewOf"] = views.callViewOf

/** The outcome an end node reaches, or null for any other node. */
export const outcomeEndViewOf: ContractViews["outcomeEndViewOf"] = views.outcomeEndViewOf

/** One contract problem in the owner's words; the step key is replaced by `titles[key]` when the reader passes step titles. */
export const contractProblemText: ContractViews["contractProblemText"] = views.contractProblemText
