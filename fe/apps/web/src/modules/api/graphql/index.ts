// The contract object types as the operations select them (the client preset emits operation results only,
// so each object type is read off the operation that selects most of its fields).
import type {
    AgentGenerationStatusQuery,
    CreditPacksBoughtQuery,
    AccountingWorkbenchQuery,
    AgentChatTurnStatusQuery,
    VideoProjectQuery,
    AskKnowledgeQuery,
    AutomationGoogleAccountsQuery,
    AutomationsQuery,
    BillingPlanQuery,
    BillingWorkspaceQuery,
    BookingBoardQuery,
    BrainQuery,
    BrandProposalsQuery,
    MarketingWeeklyReportQuery,
    CheckConnectionMutation,
    CheckMetaMutation,
    ChooseMetaPageMutation,
    ConnectionAgentsQuery,
    ConnectionFirstEventQuery,
    ConnectionsQuery,
    ContentAiStatusQuery,
    ContentConfigurationQuery,
    ContentMediaQuery,
    ContentWorkbenchQuery,
    CreateContentItemMutation,
    CreateLeadMutation,
    CreditPacksQuery,
    CreditQuotaStatusQuery,
    CreditTopupLotsQuery,
    CreditUsageSummaryQuery,
    DashboardQuery,
    DecideSalesDraftMutation,
    HiringCandidateDetailQuery,
    HiringWorkbenchQuery,
    InboundSimulationStatusQuery,
    InventoryTemplatesQuery,
    InventoryWorkbenchQuery,
    KnowledgeSourceQuery,
    KnowledgeSourcesQuery,
    KnowledgeSuggestionsQuery,
    LeadActionStatusQuery,
    LeadFlowQuery,
    LeadJourneyQuery,
    LessonMiningStatusQuery,
    LoyaltyBoardQuery,
    NivoKnowledgeQuery,
    PublicBookingPageQuery,
    PublicHiringInterviewQuery,
    PublicHiringJobQuery,
    PublicHiringOfferQuery,
    RenameInstallationAgentMutation,
    RequestContentDraftMutation,
    RequestDataSyncMutation,
    ReturnZaloAuthorizationMutation,
    SalesWorkbenchQuery,
    SaveHiringSettingsMutation,
    SaveLoyaltyRewardMutation,
    SaveVideoBrandMutation,
    ShiftsMineQuery,
    ShiftsWorkbenchQuery,
    SimulateInboundMutation,
    StartMoneyConnectionMutation,
    StartWebhookConnectionMutation,
    TestOpenApiOperationQuery,
    TestWebhookConnectionMutation,
    UpdateAutomationPipelineMutation,
    VideoMediaQuery,
    VideoRenderStatusQuery,
    VideoScriptStatusQuery,
    HiringAvailabilityWindowInput,
    HiringJobQuestionInput,
    SaveHiringJobInput,
    SaveHiringSettingsInput,
    DecideSalesDraftInput,
    DecideSalesWorkItemInput,
    HandoffToAccountingInput,
    MarkOrderShippedInput,
    RetryFailedStepInput,
    SalesWorkEditsInput,
    SaveContractInput,
    StopFailedStepInput,
} from "./__generated__/graphql"
import type { WireInput } from "./types"

/** The `AgentGenerationStatusType` object of the back end contract, as the operations of this app select it. */
export type AgentGenerationStatusType = AgentGenerationStatusQuery["agentGenerationStatus"]
/** The `CreditPackPurchaseType` object of the back end contract, as the operations of this app select it. */
export type CreditPackPurchaseType = CreditPacksBoughtQuery["creditPacksBought"][number]
/** The `AccountingLedgerEntryType` object of the back end contract, as the operations of this app select it. */
export type AccountingLedgerEntryType = AccountingWorkbenchQuery["accountingWorkbench"]["ledger"][number]
/** The `AccountingProposalType` object of the back end contract, as the operations of this app select it. */
export type AccountingProposalType =
    AccountingWorkbenchQuery["accountingWorkbench"]["questions"][number]["item"]["proposal"]
/** The `AccountingQuestionWorkType` object of the back end contract, as the operations of this app select it. */
export type AccountingQuestionWorkType = AccountingWorkbenchQuery["accountingWorkbench"]["questions"][number]["item"]
/** The `AccountingWorkbenchType` object of the back end contract, as the operations of this app select it. */
export type AccountingWorkbenchType = AccountingWorkbenchQuery["accountingWorkbench"]
/** The `AgentChatTurnStatusType` object of the back end contract, as the operations of this app select it. */
export type AgentChatTurnStatusType = AgentChatTurnStatusQuery["agentChatTurnStatus"]
/** The `AutomationCardType` object of the back end contract, as the operations of this app select it. */
export type AutomationCardType = UpdateAutomationPipelineMutation["updateAutomationPipeline"]
/** The `AutomationGoogleAccountType` object of the back end contract, as the operations of this app select it. */
export type AutomationGoogleAccountType = AutomationGoogleAccountsQuery["automationGoogleAccounts"][number]
/** The `AutomationRunType` object of the back end contract, as the operations of this app select it. */
export type AutomationRunType = AutomationsQuery["automations"]["runs"][number]
/** The `AutomationsOverviewType` object of the back end contract, as the operations of this app select it. */
export type AutomationsOverviewType = AutomationsQuery["automations"]
/** The `BillingPlanType` object of the back end contract, as the operations of this app select it. */
export type BillingPlanType = NonNullable<BillingPlanQuery["billingPlan"]>
/** The `BillingWorkspaceType` object of the back end contract, as the operations of this app select it. */
export type BillingWorkspaceType = BillingWorkspaceQuery["billingWorkspace"]
/** The `BookingBoardType` object of the back end contract, as the operations of this app select it. */
export type BookingBoardType = BookingBoardQuery["bookingBoard"]
/** The `BrainEvidenceType` object of the back end contract, as the operations of this app select it. */
export type BrainEvidenceType = BrainQuery["brain"]["facts"][number]["evidence"][number]
/** The `BrainExtractionType` object of the back end contract, as the operations of this app select it. */
export type BrainExtractionType = BrainQuery["brain"]["extractions"][number]
/** The `BrainFactType` object of the back end contract, as the operations of this app select it. */
export type BrainFactType = BrainQuery["brain"]["facts"][number]
/** The `BrainGapType` object of the back end contract, as the operations of this app select it. */
export type BrainGapType = BrainQuery["brain"]["gaps"][number]
/** The `BrainLensType` object of the back end contract, as the operations of this app select it. */
export type BrainLensType = BrainQuery["brain"]["lenses"][number]
/** The `BrainLessonType` object of the back end contract, as the operations of this app select it. */
export type BrainLessonType = BrainQuery["brain"]["lessons"][number]
/** The `ConnectionAgentType` object of the back end contract, as the operations of this app select it. */
export type ConnectionAgentType = ConnectionAgentsQuery["connectionAgents"][number]
/** The `ConnectionCheckType` object of the back end contract, as the operations of this app select it. */
export type ConnectionCheckType = CheckConnectionMutation["checkConnection"]
/** The `ConnectionType` object of the back end contract, as the operations of this app select it. */
export type ConnectionType = ConnectionsQuery["connections"][number]
/** The `ContentAiRequestedType` object of the back end contract, as the operations of this app select it. */
export type ContentAiRequestedType = RequestContentDraftMutation["requestContentDraft"]
/** The `BrandProposalType` object of the back end contract, as the operations of this app select it. */
export type BrandProposalType = BrandProposalsQuery["brandProposals"][number]
/** The `WeeklyReportType` object of the back end contract, as the operations of this app select it. */
export type WeeklyReportType = MarketingWeeklyReportQuery["marketingWeeklyReport"]
/** The `ContentAiStatusType` object of the back end contract, as the operations of this app select it. */
export type ContentAiStatusType = ContentAiStatusQuery["contentAiStatus"]
/** The `ContentAiWarningType` object of the back end contract, as the operations of this app select it. */
export type ContentAiWarningType = ContentAiStatusQuery["contentAiStatus"]["warnings"][number]
/** The `ContentConfigurationType` object of the back end contract, as the operations of this app select it. */
export type ContentConfigurationType = ContentConfigurationQuery["contentConfiguration"]
/** The `ContentItemType` object of the back end contract, as the operations of this app select it. */
export type ContentItemType = CreateContentItemMutation["createContentItem"]
/** The `ContentMediaType` object of the back end contract, as the operations of this app select it. */
export type ContentMediaType = ContentMediaQuery["contentMedia"]
/** The `ContentWorkbenchType` object of the back end contract, as the operations of this app select it. */
export type ContentWorkbenchType = ContentWorkbenchQuery["contentWorkbench"]
/** The `CreditPackType` object of the back end contract, as the operations of this app select it. */
export type CreditPackType = CreditPacksQuery["creditPacks"][number]
/** The `CreditQuotaStatusType` object of the back end contract, as the operations of this app select it. */
export type CreditQuotaStatusType = NonNullable<CreditQuotaStatusQuery["creditQuotaStatus"]>
/** The `CreditTopupLotType` object of the back end contract, as the operations of this app select it. */
export type CreditTopupLotType = CreditTopupLotsQuery["creditTopupLots"][number]
/** The `CreditUsageSummaryType` object of the back end contract, as the operations of this app select it. */
export type CreditUsageSummaryType = CreditUsageSummaryQuery["creditUsageSummary"]
/** The `DashboardType` object of the back end contract, as the operations of this app select it. */
export type DashboardType = DashboardQuery["dashboard"]
/** The `DataSyncRunType` object of the back end contract, as the operations of this app select it. */
export type DataSyncRunType = RequestDataSyncMutation["requestDataSync"]
/** The `DocumentPassageType` object of the back end contract, as the operations of this app select it. */
export type DocumentPassageType = KnowledgeSourceQuery["knowledgeSource"]["chunks"][number]
/** The `FirstEventStateType` object of the back end contract, as the operations of this app select it. */
export type FirstEventStateType = ConnectionFirstEventQuery["connectionFirstEvent"]
/** The `FirstEventType` object of the back end contract, as the operations of this app select it. */
export type FirstEventType = NonNullable<ChooseMetaPageMutation["chooseMetaPage"]["firstEvent"]>
/** The `HiringAnswerType` object of the back end contract, as the operations of this app select it. */
export type HiringAnswerType = HiringWorkbenchQuery["hiringWorkbench"]["candidates"][number]["answers"][number]
/** The `HiringBenchType` object of the back end contract, as the operations of this app select it. */
export type HiringBenchType = HiringWorkbenchQuery["hiringWorkbench"]
/** The `HiringCandidateDetailType` object of the back end contract, as the operations of this app select it. */
export type HiringCandidateDetailType = HiringCandidateDetailQuery["hiringCandidateDetail"]
/** The `HiringCandidateType` object of the back end contract, as the operations of this app select it. */
export type HiringCandidateType = HiringWorkbenchQuery["hiringWorkbench"]["candidates"][number]
/** The `HiringCvType` object of the back end contract, as the operations of this app select it. */
export type HiringCvType = NonNullable<HiringCandidateDetailQuery["hiringCandidateDetail"]["cv"]>
/** The `HiringEventType` object of the back end contract, as the operations of this app select it. */
export type HiringEventType = HiringCandidateDetailQuery["hiringCandidateDetail"]["events"][number]
/** The `HiringFiguresType` object of the back end contract, as the operations of this app select it. */
export type HiringFiguresType = HiringWorkbenchQuery["hiringWorkbench"]["figures"]
/** The `HiringInterviewType` object of the back end contract, as the operations of this app select it. */
export type HiringInterviewType = HiringWorkbenchQuery["hiringWorkbench"]["interviews"][number]
/** The `HiringJobQuestionType` object of the back end contract, as the operations of this app select it. */
export type HiringJobQuestionType = HiringWorkbenchQuery["hiringWorkbench"]["jobs"][number]["questions"][number]
/** The `HiringJobRequirementsType` object of the back end contract, as the operations of this app select it. */
export type HiringJobRequirementsType = HiringWorkbenchQuery["hiringWorkbench"]["jobs"][number]["requirements"]
/** The `HiringJobType` object of the back end contract, as the operations of this app select it. */
export type HiringJobType = HiringWorkbenchQuery["hiringWorkbench"]["jobs"][number]
/** The `HiringMemberType` object of the back end contract, as the operations of this app select it. */
export type HiringMemberType = HiringWorkbenchQuery["hiringWorkbench"]["members"][number]
/** The `HiringOfferType` object of the back end contract, as the operations of this app select it. */
export type HiringOfferType = HiringWorkbenchQuery["hiringWorkbench"]["offers"][number]
/** The `HiringOnboardingType` object of the back end contract, as the operations of this app select it. */
export type HiringOnboardingType = HiringWorkbenchQuery["hiringWorkbench"]["onboarding"][number]
/** The `HiringScoreReasonType` object of the back end contract, as the operations of this app select it. */
export type HiringScoreReasonType =
    HiringWorkbenchQuery["hiringWorkbench"]["candidates"][number]["scoreReasons"][number]
/** The `HiringSettingsType` object of the back end contract, as the operations of this app select it. */
export type HiringSettingsType = SaveHiringSettingsMutation["saveHiringSettings"]
/** The `HiringSlotType` object of the back end contract, as the operations of this app select it. */
export type HiringSlotType = HiringWorkbenchQuery["hiringWorkbench"]["interviews"][number]["proposedSlots"][number]
/** The `HiringWindowType` object of the back end contract, as the operations of this app select it. */
export type HiringWindowType = HiringWorkbenchQuery["hiringWorkbench"]["members"][number]["windows"][number]
/** The `InboundSimulationStatusType` object of the back end contract, as the operations of this app select it. */
export type InboundSimulationStatusType = InboundSimulationStatusQuery["inboundSimulationStatus"]
/** The `InventoryItemType` object of the back end contract, as the operations of this app select it. */
export type InventoryItemType = InventoryWorkbenchQuery["inventoryWorkbench"]["items"][number]
/** The `InventoryMovementType` object of the back end contract, as the operations of this app select it. */
export type InventoryMovementType = InventoryWorkbenchQuery["inventoryWorkbench"]["movements"][number]
/** The `InventoryPendingType` object of the back end contract, as the operations of this app select it. */
export type InventoryPendingType = InventoryWorkbenchQuery["inventoryWorkbench"]["pending"][number]
/** The `InventoryPoType` object of the back end contract, as the operations of this app select it. */
export type InventoryPoType = InventoryWorkbenchQuery["inventoryWorkbench"]["pos"][number]
/** The `InventoryRecipeType` object of the back end contract, as the operations of this app select it. */
export type InventoryRecipeType = InventoryWorkbenchQuery["inventoryWorkbench"]["recipes"][number]
/** The `InventorySupplierType` object of the back end contract, as the operations of this app select it. */
export type InventorySupplierType = InventoryWorkbenchQuery["inventoryWorkbench"]["suppliers"][number]
/** The `InventoryTemplateType` object of the back end contract, as the operations of this app select it. */
export type InventoryTemplateType = InventoryTemplatesQuery["inventoryTemplates"][number]
/** The `InventoryWorkbenchType` object of the back end contract, as the operations of this app select it. */
export type InventoryWorkbenchType = InventoryWorkbenchQuery["inventoryWorkbench"]
/** The `KnowledgeSourceTextType` object of the back end contract, as the operations of this app select it. */
export type KnowledgeSourceTextType = KnowledgeSourceQuery["knowledgeSource"]["source"]
/** The `KnowledgeSourceType` object of the back end contract, as the operations of this app select it. */
export type KnowledgeSourceType = KnowledgeSourcesQuery["knowledgeSources"][number]
/** The `KnowledgeSuggestionContextType` object of the back end contract, as the operations of this app select it. */
export type KnowledgeSuggestionContextType = KnowledgeSuggestionsQuery["knowledgeSuggestions"]
/** The `LeadActionQueuedType` object of the back end contract, as the operations of this app select it. */
export type LeadActionQueuedType = CreateLeadMutation["createLead"]
/** The `LeadActionStatusType` object of the back end contract, as the operations of this app select it. */
export type LeadActionStatusType = LeadActionStatusQuery["leadActionStatus"]
/** The `LeadFlowDecisionType` object of the back end contract, as the operations of this app select it. */
export type LeadFlowDecisionType = LeadFlowQuery["leadFlow"]["decisions"][number]
/** The `LeadFlowInvoiceType` object of the back end contract, as the operations of this app select it. */
export type LeadFlowInvoiceType = LeadFlowQuery["leadFlow"]["invoices"][number]
/** The `LeadFlowOrderType` object of the back end contract, as the operations of this app select it. */
export type LeadFlowOrderType = LeadFlowQuery["leadFlow"]["orders"][number]
/** The `LeadFlowTransactionType` object of the back end contract, as the operations of this app select it. */
export type LeadFlowTransactionType = LeadFlowQuery["leadFlow"]["transactions"][number]
/** The `LeadFlowType` object of the back end contract, as the operations of this app select it. */
export type LeadFlowType = LeadFlowQuery["leadFlow"]
/** The `LeadFlowWorkItemType` object of the back end contract, as the operations of this app select it. */
export type LeadFlowWorkItemType = LeadFlowQuery["leadFlow"]["workItems"][number]
/** The `LeadJourneyType` object of the back end contract, as the operations of this app select it. */
export type LeadJourneyType = LeadJourneyQuery["leadJourney"]
/** The `LeadRecordType` object of the back end contract, as the operations of this app select it. */
export type LeadRecordType = LeadJourneyQuery["leadJourney"]["lead"]
/** The `LessonMiningStatusType` object of the back end contract, as the operations of this app select it. */
export type LessonMiningStatusType = LessonMiningStatusQuery["lessonMiningStatus"]
/** The `LocalizedTextType` object of the back end contract, as the operations of this app select it. */
export type LocalizedTextType = UpdateAutomationPipelineMutation["updateAutomationPipeline"]["missing"][number]["label"]
/** The `LoyaltyBoardType` object of the back end contract, as the operations of this app select it. */
export type LoyaltyBoardType = LoyaltyBoardQuery["loyaltyBoard"]
/** The `LoyaltyConfigType` object of the back end contract, as the operations of this app select it. */
export type LoyaltyConfigType = LoyaltyBoardQuery["loyaltyBoard"]["config"]
/** The `LoyaltyMemberType` object of the back end contract, as the operations of this app select it. */
export type LoyaltyMemberType = LoyaltyBoardQuery["loyaltyBoard"]["members"][number]
/** The `LoyaltyRewardType` object of the back end contract, as the operations of this app select it. */
export type LoyaltyRewardType = SaveLoyaltyRewardMutation["saveLoyaltyReward"]
/** The `LoyaltyTierType` object of the back end contract, as the operations of this app select it. */
export type LoyaltyTierType = LoyaltyBoardQuery["loyaltyBoard"]["config"]["tiers"][number]
/** The `MetaAppObjectType` object of the back end contract, as the operations of this app select it. */
export type MetaAppObjectType = NonNullable<CheckMetaMutation["checkMeta"]["appPage"]>
/** The `MetaCheckType` object of the back end contract, as the operations of this app select it. */
export type MetaCheckType = CheckMetaMutation["checkMeta"]
/** The `MetaWizardConnectionType` object of the back end contract, as the operations of this app select it. */
export type MetaWizardConnectionType = ChooseMetaPageMutation["chooseMetaPage"]
/** The `MissingRequirementType` object of the back end contract, as the operations of this app select it. */
export type MissingRequirementType = UpdateAutomationPipelineMutation["updateAutomationPipeline"]["missing"][number]
/** The `ModuleInstallationType` object of the back end contract, as the operations of this app select it. */
export type ModuleInstallationType = RenameInstallationAgentMutation["renameInstallationAgent"]
/** The `NivoEntryType` object of the back end contract, as the operations of this app select it. */
export type NivoEntryType = NivoKnowledgeQuery["nivoKnowledge"][number]
/** The `OpenApiTestType` object of the back end contract, as the operations of this app select it. */
export type OpenApiTestType = TestOpenApiOperationQuery["testOpenApiOperation"]
/** The `PreviewSampleType` object of the back end contract, as the operations of this app select it. */
export type PreviewSampleType = AutomationsQuery["automations"]["sample"]
/** The `PublicBookingPageType` object of the back end contract, as the operations of this app select it. */
export type PublicBookingPageType = PublicBookingPageQuery["publicBookingPage"]
/** The `PublicInterviewType` object of the back end contract, as the operations of this app select it. */
export type PublicInterviewType = PublicHiringInterviewQuery["publicHiringInterview"]
/** The `PublicJobType` object of the back end contract, as the operations of this app select it. */
export type PublicJobType = PublicHiringJobQuery["publicHiringJob"]
/** The `PublicOfferType` object of the back end contract, as the operations of this app select it. */
export type PublicOfferType = PublicHiringOfferQuery["publicHiringOffer"]
/** The `PublicQuestionType` object of the back end contract, as the operations of this app select it. */
export type PublicQuestionType = PublicHiringJobQuery["publicHiringJob"]["questions"][number]
/** The `PublicRequirementsType` object of the back end contract, as the operations of this app select it. */
export type PublicRequirementsType = PublicHiringJobQuery["publicHiringJob"]["requirements"]
/** The `PublicSlotType` object of the back end contract, as the operations of this app select it. */
export type PublicSlotType = PublicHiringInterviewQuery["publicHiringInterview"]["proposedSlots"][number]
/** The `RetrievedPassageType` object of the back end contract, as the operations of this app select it. */
export type RetrievedPassageType = AskKnowledgeQuery["askKnowledge"][number]
/** The `RunStepType` object of the back end contract, as the operations of this app select it. */
export type RunStepType = AutomationsQuery["automations"]["runs"][number]["steps"][number]
/** The `SalesActionType` object of the back end contract, as the operations of this app select it. */
export type SalesActionType = DecideSalesDraftMutation["decideSalesDraft"]
/** The `SalesWorkbenchType` object of the back end contract, as the operations of this app select it. */
export type SalesWorkbenchType = SalesWorkbenchQuery["salesWorkbench"]
/** The `ShiftPositionType` object of the back end contract, as the operations of this app select it. */
export type ShiftPositionType = ShiftsWorkbenchQuery["shiftsWorkbench"]["setup"]["positions"][number]
/** The `ShiftStaffType` object of the back end contract, as the operations of this app select it. */
export type ShiftStaffType = ShiftsWorkbenchQuery["shiftsWorkbench"]["setup"]["staff"][number]
/** The `ShiftType` object of the back end contract, as the operations of this app select it. */
export type ShiftType = ShiftsMineQuery["shiftsMine"]["openShifts"][number]
/** The `ShiftsAvailType` object of the back end contract, as the operations of this app select it. */
export type ShiftsAvailType = ShiftsWorkbenchQuery["shiftsWorkbench"]["week"]["approvedAvail"][number]
/** The `ShiftsAvailabilityType` object of the back end contract, as the operations of this app select it. */
export type ShiftsAvailabilityType = ShiftsMineQuery["shiftsMine"]["availability"][number]
/** The `ShiftsBenchType` object of the back end contract, as the operations of this app select it. */
export type ShiftsBenchType = ShiftsWorkbenchQuery["shiftsWorkbench"]
/** The `ShiftsBlockType` object of the back end contract, as the operations of this app select it. */
export type ShiftsBlockType = ShiftsWorkbenchQuery["shiftsWorkbench"]["setup"]["blocks"][number]
/** The `ShiftsFiguresType` object of the back end contract, as the operations of this app select it. */
export type ShiftsFiguresType = NonNullable<ShiftsWorkbenchQuery["shiftsWorkbench"]["figures"]>
/** The `ShiftsLeaveType` object of the back end contract, as the operations of this app select it. */
export type ShiftsLeaveType = ShiftsMineQuery["shiftsMine"]["leaves"][number]
/** The `ShiftsMineType` object of the back end contract, as the operations of this app select it. */
export type ShiftsMineType = ShiftsMineQuery["shiftsMine"]
/** The `ShiftsPriorType` object of the back end contract, as the operations of this app select it. */
export type ShiftsPriorType = ShiftsWorkbenchQuery["shiftsWorkbench"]["week"]["prior"][number]
/** The `ShiftsScheduleType` object of the back end contract, as the operations of this app select it. */
export type ShiftsScheduleType = NonNullable<ShiftsWorkbenchQuery["shiftsWorkbench"]["week"]["current"]>
/** The `ShiftsSettingsType` object of the back end contract, as the operations of this app select it. */
export type ShiftsSettingsType = ShiftsWorkbenchQuery["shiftsWorkbench"]["setup"]["settings"]
/** The `ShiftsSetupType` object of the back end contract, as the operations of this app select it. */
export type ShiftsSetupType = ShiftsWorkbenchQuery["shiftsWorkbench"]["setup"]
/** The `ShiftsSwapType` object of the back end contract, as the operations of this app select it. */
export type ShiftsSwapType = ShiftsMineQuery["shiftsMine"]["swaps"][number]
/** The `ShiftsWeekType` object of the back end contract, as the operations of this app select it. */
export type ShiftsWeekType = ShiftsWorkbenchQuery["shiftsWorkbench"]["week"]
/** The `ShiftsWorkItemType` object of the back end contract, as the operations of this app select it. */
export type ShiftsWorkItemType = NonNullable<ShiftsMineQuery["shiftsMine"]["leaves"][number]["item"]>
/** The `SimulateInboundType` object of the back end contract, as the operations of this app select it. */
export type SimulateInboundType = SimulateInboundMutation["simulateInbound"]
/** The `TemplateDefinitionType` object of the back end contract, as the operations of this app select it. */
export type TemplateDefinitionType = UpdateAutomationPipelineMutation["updateAutomationPipeline"]["def"]
/** The `TemplateSettingType` object of the back end contract, as the operations of this app select it. */
export type TemplateSettingType =
    UpdateAutomationPipelineMutation["updateAutomationPipeline"]["def"]["settings"][number]
/** The `VideoBrandType` object of the back end contract, as the operations of this app select it. */
export type VideoBrandType = SaveVideoBrandMutation["saveVideoBrand"]
/** The `VideoMediaType` object of the back end contract, as the operations of this app select it. */
export type VideoMediaType = VideoMediaQuery["videoMedia"][number]
/** The `VideoProjectType` object of the back end contract, as the operations of this app select it. */
export type VideoProjectType = VideoProjectQuery["videoProject"]
/** The `VideoRenderStatusType` object of the back end contract, as the operations of this app select it. */
export type VideoRenderStatusType = VideoRenderStatusQuery["videoRenderStatus"]
/** The `VideoScriptStatusType` object of the back end contract, as the operations of this app select it. */
export type VideoScriptStatusType = VideoScriptStatusQuery["videoScriptStatus"]
/** The `WebhookTestResultType` object of the back end contract, as the operations of this app select it. */
export type WebhookTestResultType = TestWebhookConnectionMutation["testWebhookConnection"]
/** The `WebhookViewType` object of the back end contract, as the operations of this app select it. */
export type WebhookViewType = StartWebhookConnectionMutation["startWebhookConnection"]
/** The `WizardConnectionType` object of the back end contract, as the operations of this app select it. */
export type WizardConnectionType = StartMoneyConnectionMutation["startMoneyConnection"]
/** The `ZaloWizardConnectionType` object of the back end contract, as the operations of this app select it. */
export type ZaloWizardConnectionType = ReturnZaloAuthorizationMutation["returnZaloAuthorization"]
/** The `HiringAvailabilityWindowInput` of the back end contract as callers build it, optional keys optional. */
export type HiringAvailabilityWindowRequest = WireInput<HiringAvailabilityWindowInput>
/** The `HiringJobQuestionInput` of the back end contract as callers build it, optional keys optional. */
export type HiringJobQuestionRequest = WireInput<HiringJobQuestionInput>
/** The `SaveHiringJobInput` of the back end contract as callers build it, optional keys optional. */
export type SaveHiringJobRequest = WireInput<SaveHiringJobInput>
/** The `SaveHiringSettingsInput` of the back end contract as callers build it, optional keys optional. */
export type SaveHiringSettingsRequest = WireInput<SaveHiringSettingsInput>
/** The `DecideSalesDraftInput` of the back end contract as callers build it, optional keys optional. */
export type DecideSalesDraftRequest = WireInput<DecideSalesDraftInput>
/** The `DecideSalesWorkItemInput` of the back end contract as callers build it, optional keys optional. */
export type DecideSalesWorkItemRequest = WireInput<DecideSalesWorkItemInput>
/** The `HandoffToAccountingInput` of the back end contract as callers build it, optional keys optional. */
export type HandoffToAccountingRequest = WireInput<HandoffToAccountingInput>
/** The `MarkOrderShippedInput` of the back end contract as callers build it, optional keys optional. */
export type MarkOrderShippedRequest = WireInput<MarkOrderShippedInput>
/** The `RetryFailedStepInput` of the back end contract as callers build it, optional keys optional. */
export type RetryFailedStepRequest = WireInput<RetryFailedStepInput>
/** The `SalesWorkEditsInput` of the back end contract as callers build it, optional keys optional. */
export type SalesWorkEditsRequest = WireInput<SalesWorkEditsInput>
/** The `SaveContractInput` of the back end contract as callers build it, optional keys optional. */
export type SaveContractRequest = WireInput<SaveContractInput>
/** The `StopFailedStepInput` of the back end contract as callers build it, optional keys optional. */
export type StopFailedStepRequest = WireInput<StopFailedStepInput>
