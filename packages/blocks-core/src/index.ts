export {
    agentMessagePostEffect,
    agentTagEffect,
    bankTransactionKind,
    catalogueItemKind,
    channelSendEffect,
    conversationKind,
    coreDataKinds,
    coreEffects,
    coreTools,
    knowledgeDocumentKind,
    messageKind,
    orderKind,
    paymentClaimKind,
    salesLeadKind,
    EFFECT_REFUSED,
    isRefusal,
    paymentQrTextOf,
    cardOrderOf,
    matchedCreditsOf,
    teamCardPostOf,
    teamOrderCardOf,
    teamPaymentCardOf,
    refusalOf,
    TOOL,
    TOOL_LABELS,
    toolLabelOf,
} from "./shared/vocabulary"
export type {
    CardOrder,
    EffectFact,
    EffectFacts,
    TeamAudience,
    TeamCard,
    ToolId,
    ToolLabel,
    ToolLabelKind,
} from "./shared/vocabulary"
export type {
    AgentTagPayload,
    ChannelSendPayload,
    AgentMessagePostPayload,
} from "./shared/vocabulary"

export { agentMessageBlock } from "./shared/blocks/agent-message.block"
export { AGENT_MESSAGE_INTENTS, agentMessageItemOf } from "./shared/agent-message/agent-message-item"
export { agentMessageKinds } from "./shared/agent-message/module-agent-message-kinds"
export type { AgentMessageIntent, AgentMessageItem, AgentMessageRecord } from "./shared/agent-message/agent-message-item"
export { asideDetailBlock } from "./shared/blocks/aside-detail.block"
export { cardGridBlock } from "./shared/blocks/card-grid.block"
export { chatbotBlocks } from "./agents/chatbot/workbench/blocks/chatbot-blocks"
export { formBlock } from "./shared/blocks/form.block"
export { listEditorBlock } from "./shared/blocks/list-editor.block"
export { tabbedPanelBlock } from "./shared/blocks/tabbed-panel.block"
export { tableBlock } from "./shared/blocks/table.block"
export { dashboardCardsBlock } from "./shared/blocks/dashboard-cards.block"
export { decisionQueueBlock } from "./shared/blocks/decision-queue.block"
export { detailBlock } from "./shared/blocks/detail.block"
export { explanationBlock } from "./shared/blocks/explanation.block"
export { figuresBlock } from "./shared/blocks/figures.block"
export { filePreviewBlock } from "./shared/blocks/file-preview.block"
export { fileUploadBlock } from "./shared/blocks/file-upload.block"
export { masterDetailBlock } from "./shared/blocks/master-detail.block"
export { recordListBlock } from "./shared/blocks/record-list.block"
export { sectionBlock } from "./shared/blocks/section.block"
export { stackBlock } from "./shared/blocks/stack.block"
export { linkBlock } from "./shared/blocks/link.block"
export { waitingBlock } from "./shared/blocks/waiting.block"
export { coreBlocks } from "./shared/blocks/core-blocks"
export { agentFlowsBlock } from "./shared/blocks/agent-flows.block"
export { reachCardBlock } from "./shared/blocks/reach-card.block"
export { DATA_VIEW_PREFIX, dataSetPathOf, dataSetViewOf, dataSetsBlock } from "./shared/blocks/data-sets.block"
export {
    DESK_VIEW_ID,
    PROVIDER_READ_NAME,
    openApiReadsOf,
    providerReadOf,
    workbenchSpecProblems,
} from "./shared/workbench/workbench-spec-problems"
export type { ProviderReadFacts, WorkbenchProblem, WorkbenchRuleCode } from "./shared/workbench/workbench-spec-problems"
export { DATA_PAGE_WORDS, agentDeskViewOf, viewNodeOf, withAgentDesk } from "./shared/platform/specs/agent-desk"
export type { DeskDataSet, DeskOfModule } from "./shared/platform/specs/agent-desk"

export { coreControlNodes, coreNodeViews, coreTemplateNodes } from "./shared/nodes/node-lists"
export type { ViewNode } from "./shared/nodes/node-ui"
export { corePlugin } from "./plugin"
export type { TeamChatAnswer } from "./shared/vocabulary/effects"
export { modelWordsOf } from "./shared/messages/catalog"
export { BRAIN_FACT_FIELDS_POINTER, BRAIN_FACT_LEGEND } from "./shared/vocabulary/brain-fact-legend"
export { DEFAULT_THRESHOLD_VND } from "./agents/sales/rules/settings"
export { transferContentOf } from "./agents/sales/nodes/order-lines.policy"
export { shopDayOf, shopNoonMsOf } from "./agents/sales/ledger/rules/shop-time"
export { creditsNamingCode } from "./agents/sales/ledger/rules/rematch"
export type { OrderRecord, TransactionRecord } from "./agents/sales/ledger/rules/accounting.types"
export { CARE_KINDS } from "./agents/sales/nodes/care.policy"
export type { CareKind } from "./agents/sales/nodes/care.policy"

export {
    AUTO_MODEL,
    AUTO_MODEL_OF_WEIGHT,
    CHEAP_MODEL,
    DEEPSEEK_MODEL,
    DEFAULT_MODEL,
    HAIKU_MODEL,
    ENGINE_CORE_MODEL,
    MODEL_ENTRIES,
    MODEL_IDS,
    RETIRED_MODEL_IDS,
    NODE_MODELS,
    SONNET_MODEL,
    STRONGER_MODEL,
    isModelChoice,
    isModelId,
    isRetiredModel,
    modelEntryOf,
    nodeModelOf,
} from "./shared/models"
export type {
    ModelChoice,
    ModelEntry,
    ModelId,
    ModelProvider,
    RetiredModelEntry,
    RetiredModelId,
    NodeModel,
    NodeWorkKind,
    StepWeight,
} from "./shared/models"
export { EMBEDDING_PROFILE, EMBEDDING_PROFILES, OPENAI_EMBEDDING_MODEL, embeddingIdentityOf } from "./shared/models"
export type { EmbeddingModelOfProfile } from "./shared/models"

export { lineOrderOfRow, orderAddressOf, orderCardOf, orderCardWithPhotos } from "./agents/sales/nodes/order-card.policy"

// The template tree: the shared helpers plugins build on, every template node, graph, agent and account list (each graph carries its
// own catalogue entry).

// Shared helpers.
export {
    answered,
    contextAnswer,
    contextFactsOf,
    refused,
    sentAnswer,
    textOrNull,
    valueOrCannot,
    viaAccount,
} from "./shared/nodes/tool-answers"
export type { AnsweredVia } from "./shared/nodes/tool-answers"
export { saidOrCannot, sayToCustomer } from "./shared/customer-chat/say-to-customer"
export type { SayChat, SayContext, SayInput, SayOptions, SayReceipt, SayResult, SentImage } from "./shared/customer-chat/say-to-customer"

// Chatbot: nodes, the thread reader, the messaging accounts, the front desk and the agent.
export { chatbotHearNode } from "./agents/chatbot/nodes/hear.node"
export type { HearNodeInput, HearOutput } from "./agents/chatbot/nodes/hear.node"
export { chatbotUnderstandNode } from "./agents/chatbot/nodes/understand.node"
export type {
    UnderstandBranch,
    UnderstandFile,
    UnderstandInput,
    UnderstandMessage,
    UnderstandOutput,
} from "./agents/chatbot/nodes/understand.node"
export { chatbotAnswerNode } from "./agents/chatbot/nodes/answer.node"
export type { AnswerInput, AnswerOutput } from "./agents/chatbot/nodes/answer.node"
export { chatbotComplaintReplyNode } from "./agents/chatbot/nodes/complaint-reply.node"
export type { ComplaintReplyInput, ComplaintReplyOutput } from "./agents/chatbot/nodes/complaint-reply.node"
export { chatbotComplaintNotifyNode } from "./agents/chatbot/nodes/complaint-notify.node"
export type { ComplaintNotifyInput, ComplaintNotifyOutput } from "./agents/chatbot/nodes/complaint-notify.node"
export { lastOrderCodeOf, threadLinesOf, threadOf, threadRowsOf } from "./shared/customer-chat/front-desk.reads"
export type { ThreadFact, ThreadFile } from "./shared/customer-chat/front-desk.reads"
export { CHATBOT_MESSAGING } from "./agents/chatbot/nodes/chatbot.accounts"
export { FRONT_DESK_GRAPH_KEY, frontDeskGraph } from "./agents/chatbot/graphs/front-desk.graph"
export { chatbotAgent } from "./agents/chatbot/graphs/chatbot.agent"

// Team chat: the answer turn, the propose and post steps, the graph factory every agent ships.
export { teamChatNode } from "./shared/team-chat/team/team-chat.node"
export type { TeamChatAsker, TeamChatInput, TeamChatLine, TeamChatOutput } from "./shared/team-chat/team/team-chat.node"
export { teamTruthProposeNode } from "./shared/team-chat/team/truth-propose.node"
export type { TruthProposeInput, TruthProposeOutcome, TruthProposeOutput } from "./shared/team-chat/team/truth-propose.node"
export { teamAnswerPostNode } from "./shared/team-chat/team/answer-post.node"
export type { AnswerPostInput, AnswerPostOutput } from "./shared/team-chat/team/answer-post.node"
export { teamDeclinedNoticeNode } from "./shared/team-chat/team/declined-notice.node"
export type {
    DeclinedNoticeInput,
    DeclinedNoticeInputGiven,
    DeclinedNoticeOutput,
    DeclinedNoticeScope,
} from "./shared/team-chat/team/declined-notice.node"
export { teamProposalSchema } from "./shared/team-chat/team/team-proposal"
export type { TeamProposal } from "./shared/team-chat/team/team-proposal"
export {
    TEAM_CHAT_ANSWER_MAX,
    TEAM_CHAT_LINES_MAX,
    TEAM_CHAT_LINE_MAX,
    TEAM_CHAT_TEXT_MAX,
} from "./shared/team-chat/team/team-chat.policy"
export type { TeamChatIntent, TeamChatRoom, TeamChatStanding } from "./shared/team-chat/team/team-chat.policy"
export {
    TEAM_CHAT_GRAPHS,
    TEAM_CHAT_MODULES,
    TEAM_CHAT_TURN_MEMBERS,
    TEAM_CHAT_WORKFLOW_KEY,
    teamChatGraphOf,
    teamChatInputSchema,
    teamChatLineSchema,
} from "./shared/team-chat/team-chat.graph"
export type { TeamChatCall, TeamChatTurnMember } from "./shared/team-chat/team-chat.graph"
export type { TeamAnswerTurn } from "./shared/team-chat/team-chat.graph"

// Sales and order: nodes.
export { salesConsultTurnNode, CONSULT_ROUTES, customerPicturesOf } from "./agents/sales/nodes/consult-turn.node"
export type { ConsultDraft, ConsultTurnInput, ConsultTurnOutput } from "./agents/sales/nodes/consult-turn.node"
export { salesConsultStageNode } from "./agents/sales/nodes/consult-stage.node"
export type { ConsultStageInput, ConsultStageOutput, ConsultStageParams } from "./agents/sales/nodes/consult-stage.node"
export { saidOccasionSchema, OCCASIONS_MAX } from "./agents/sales/nodes/consult.occasion"
export type { SaidOccasion } from "./agents/sales/nodes/consult.occasion"
export { salesOccasionKeepNode } from "./agents/sales/nodes/occasion-keep.node"
export type { OccasionKeepInput, OccasionKeepOutput } from "./agents/sales/nodes/occasion-keep.node"
export { salesOrderCancelNode } from "./agents/sales/nodes/order-cancel.node"
export type { OrderCancelInput, OrderCancelOutput } from "./agents/sales/nodes/order-cancel.node"
export { salesOrderCancelTellNode } from "./agents/sales/nodes/order-cancel-tell.node"
export { salesOrderCreateNode } from "./agents/sales/nodes/order-create.node"
export { salesCancelPaidNoticeNode } from "./agents/sales/nodes/cancel-paid-notice.node"
export { salesAwaitingOrdersNode } from "./agents/sales/nodes/awaiting-orders.node"
export { salesOrderPaidNode } from "./agents/sales/nodes/order-paid.node"
export { salesPaymentShortNode } from "./agents/sales/nodes/payment-short.node"
export { salesCreditTallyNode } from "./agents/sales/nodes/credit-tally.node"
export { salesOrderTellNode } from "./agents/sales/nodes/order-tell.node"
export { salesRequestQrNode } from "./agents/sales/nodes/request-qr.node"
export { salesOrderReadNode } from "./agents/sales/nodes/order-read.node"
export { salesPaymentRemindNode } from "./agents/sales/nodes/payment-remind.node"
export { salesCreditReadNode } from "./agents/sales/nodes/credit-read.node"
export { salesCreditNoticeNode } from "./agents/sales/nodes/credit-notice.node"
export { salesNotSaleNoticeNode } from "./agents/sales/nodes/not-sale-notice.node"
export { salesPaidClaimReplyNode } from "./agents/sales/nodes/paid-claim-reply.node"
export { salesPaidClaimNoticeNode } from "./agents/sales/nodes/paid-claim-notice.node"
export type { OrderCancelTellInput, OrderCancelTellOutput } from "./agents/sales/nodes/order-cancel-tell.node"
export { salesWebOrderLeadNode } from "./agents/sales/nodes/web-order-lead.node"
export type { WebOrderLeadInput, WebOrderLeadOutput } from "./agents/sales/nodes/web-order-lead.node"
export { salesWebOrderKeepNode } from "./agents/sales/nodes/web-order-keep.node"
export type { WebOrderKeepInput, WebOrderKeepOutput } from "./agents/sales/nodes/web-order-keep.node"
export { salesWebOrderNoticeNode } from "./agents/sales/nodes/web-order-notice.node"
export type { WebOrderNoticeInput, WebOrderNoticeOutput } from "./agents/sales/nodes/web-order-notice.node"
export { salesAfterSaleNode } from "./agents/sales/nodes/care-after-sale.node"
export type { AfterSaleInput, AfterSaleOutput } from "./agents/sales/nodes/care-after-sale.node"
export { salesCareDeliveryCheckNode } from "./agents/sales/nodes/care-delivery-check.node"
export type { CareDeliveryCheckInput, CareDeliveryCheckOutput } from "./agents/sales/nodes/care-delivery-check.node"
export { DELIVERY_WAIT_ROUTES, salesCareDeliveryWaitNode } from "./agents/sales/nodes/care-delivery-wait.node"
export type { CareDeliveryWaitInput, CareDeliveryWaitOutput, DeliveryDue } from "./agents/sales/nodes/care-delivery-wait.node"
export { salesCareOccasionNode } from "./agents/sales/nodes/care-occasion.node"
export type { CareOccasionInput, CareOccasionOutput } from "./agents/sales/nodes/care-occasion.node"
export { salesCareOccasionRearmNode } from "./agents/sales/nodes/care-occasion-rearm.node"
export type {
    CareOccasionRearmInput,
    CareOccasionRearmOutput,
    CareOccasionRearmParams,
} from "./agents/sales/nodes/care-occasion-rearm.node"
export {
    OCCASION_WAIT_ROUTES,
    occasionDueSchema,
    salesCareOccasionWaitNode,
} from "./agents/sales/nodes/care-occasion-wait.node"
export type {
    CareOccasionWaitInput,
    CareOccasionWaitOutput,
    CareOccasionWaitParams,
    OccasionDue,
} from "./agents/sales/nodes/care-occasion-wait.node"
export { salesCarePlanDeliveryNode } from "./agents/sales/nodes/care-plan-delivery.node"
export type { CarePlanDeliveryInput, CarePlanDeliveryOutput } from "./agents/sales/nodes/care-plan-delivery.node"
export { salesCarePlanOccasionsNode } from "./agents/sales/nodes/care-plan-occasions.node"
export type {
    CarePlanOccasionsInput,
    CarePlanOccasionsOutput,
    CarePlanOccasionsParams,
} from "./agents/sales/nodes/care-plan-occasions.node"

// Sales: accounts, declaration, graphs, catalogues, the agent.
export { SALES_CONSULT_PROVIDERS } from "./agents/sales/sales.accounts"
export { SALES_MODULE_KEY, salesModule } from "./agents/sales/declaration"
export { careTimerInput } from "./agents/sales/graphs/care.timer"
export { salesConsultGraph } from "./agents/sales/graphs/consult.graph"
export { salesAfterSaleGraph } from "./agents/sales/graphs/after-sale.graph"
export { salesDeliveryCheckGraph } from "./agents/sales/graphs/delivery-check.graph"
export { salesOccasionGraph } from "./agents/sales/graphs/occasion.graph"
export { salesWebOrderGraph } from "./agents/sales/graphs/web-order.graph"
export { salesAgent } from "./agents/sales/graphs/sales.agent"

