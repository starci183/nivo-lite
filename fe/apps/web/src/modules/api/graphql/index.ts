// The contract object types as the operations select them (the client preset emits operation results only,
// so each object type is read off the operation that selects most of its fields).
import type {
    AgentGenerationStatusQuery,
    AgentKnowledgeLensesQuery,
    CreditPacksBoughtQuery,
    AgentChatTurnStatusQuery,
    VideoProjectQuery,
    AskKnowledgeQuery,
    BillingPlanQuery,
    BillingWorkspaceQuery,
    BookingBoardQuery,
    BrainQuery,
    PublicDocumentsQuery,
    BrandProposalsQuery,
    MarketingWeeklyReportQuery,
    CheckConnectionMutation,
    CheckMetaMutation,
    ChooseMetaPageMutation,
    ConnectionAgentsQuery,
    ConnectionFirstEventQuery,
    ConnectionsQuery,
    CreditPacksQuery,
    CreditQuotaStatusQuery,
    CreditTopupLotsQuery,
    CreditUsageSummaryQuery,
    HiringCandidateDetailQuery,
    HiringWorkbenchQuery,
    KnowledgeSourceQuery,
    KnowledgeSourcesQuery,
    KnowledgeSuggestionsQuery,
    LessonMiningStatusQuery,
    ModuleInstallationsQuery,
    NivoKnowledgeQuery,
    PublicBookingPageQuery,
    PublicHiringInterviewQuery,
    PublicHiringJobQuery,
    PublicHiringOfferQuery,
    RequestDataSyncMutation,
    ReturnZaloAuthorizationMutation,
    SaveHiringSettingsMutation,
    SaveVideoBrandMutation,
    StartMoneyConnectionMutation,
    StartWebhookConnectionMutation,
    TestOpenApiOperationQuery,
    TestWebhookConnectionMutation,
    VideoMediaQuery,
    VideoRenderStatusQuery,
    VideoScriptStatusQuery,
    HiringAvailabilityWindowInput,
    HiringJobQuestionInput,
    SaveHiringJobInput,
    SaveHiringSettingsInput,
    MyAgentTemplatesQuery,
    MarketplaceListingsQuery,
    TemplateUpdateOffersQuery,
    AgentTemplatePreviewQuery,
    PackageAgentTemplateMutation,
    ImportAgentTemplateMutation,
    InstallTemplateListingMutation,
    OrderTemplateListingMutation,
    AcceptTemplateUpdateMutation,
    SubmitTemplateListingMutation,
} from "./__generated__/graphql"
import type { WireInput } from "./types"

/** The `AgentGenerationStatusType` object of the back end contract, as the operations of this app select it. */
export type AgentGenerationStatusType = AgentGenerationStatusQuery["agentGenerationStatus"]
/** The `CreditPackPurchaseType` object of the back end contract, as the operations of this app select it. */
export type CreditPackPurchaseType = CreditPacksBoughtQuery["creditPacksBought"][number]
/** The `AgentChatTurnStatusType` object of the back end contract, as the operations of this app select it. */
export type AgentChatTurnStatusType = AgentChatTurnStatusQuery["agentChatTurnStatus"]
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
/** The `AgentKnowledgeLensType` object of the back end contract, as the operations of this app select it. */
export type AgentKnowledgeLensType = AgentKnowledgeLensesQuery["agentKnowledgeLenses"][number]

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
/** The `BrandProposalType` object of the back end contract, as the operations of this app select it. */
export type BrandProposalType = BrandProposalsQuery["brandProposals"][number]
/** The `WeeklyReportType` object of the back end contract, as the operations of this app select it. */
export type WeeklyReportType = MarketingWeeklyReportQuery["marketingWeeklyReport"]
/** The `CreditPackType` object of the back end contract, as the operations of this app select it. */
export type CreditPackType = CreditPacksQuery["creditPacks"][number]
/** The `CreditQuotaStatusType` object of the back end contract, as the operations of this app select it. */
export type CreditQuotaStatusType = NonNullable<CreditQuotaStatusQuery["creditQuotaStatus"]>
/** The `CreditTopupLotType` object of the back end contract, as the operations of this app select it. */
export type CreditTopupLotType = CreditTopupLotsQuery["creditTopupLots"][number]
/** The `CreditUsageSummaryType` object of the back end contract, as the operations of this app select it. */
export type CreditUsageSummaryType = CreditUsageSummaryQuery["creditUsageSummary"]
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
/** The `KnowledgeSourceTextType` object of the back end contract, as the operations of this app select it. */
export type KnowledgeSourceTextType = KnowledgeSourceQuery["knowledgeSource"]["source"]
/** The `KnowledgeSourceType` object of the back end contract, as the operations of this app select it. */
export type KnowledgeSourceType = KnowledgeSourcesQuery["knowledgeSources"][number]
/** The `KnowledgeSuggestionContextType` object of the back end contract, as the operations of this app select it. */
export type KnowledgeSuggestionContextType = KnowledgeSuggestionsQuery["knowledgeSuggestions"]
/** The `LessonMiningStatusType` object of the back end contract, as the operations of this app select it. */
export type LessonMiningStatusType = LessonMiningStatusQuery["lessonMiningStatus"]
/** The `MetaAppObjectType` object of the back end contract, as the operations of this app select it. */
export type MetaAppObjectType = NonNullable<CheckMetaMutation["checkMeta"]["appPage"]>
/** The `MetaCheckType` object of the back end contract, as the operations of this app select it. */
export type MetaCheckType = CheckMetaMutation["checkMeta"]
/** The `MetaWizardConnectionType` object of the back end contract, as the operations of this app select it. */
export type MetaWizardConnectionType = ChooseMetaPageMutation["chooseMetaPage"]
/** The `ModuleInstallationType` object of the back end contract, as the operations of this app select it. */
export type ModuleInstallationType = ModuleInstallationsQuery["moduleInstallations"][number]
/** The `NivoEntryType` object of the back end contract, as the operations of this app select it. */
export type NivoEntryType = NivoKnowledgeQuery["nivoKnowledge"][number]
/** The `OpenApiTestType` object of the back end contract, as the operations of this app select it. */
export type OpenApiTestType = TestOpenApiOperationQuery["testOpenApiOperation"]
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
/** The `PublicDocumentType` object of the back end contract, as the operations of this app select it. */
export type PublicDocumentType = PublicDocumentsQuery["publicDocuments"][number]

// --- agent template marketplace ---
/** The answer of the myAgentTemplates operation. */
export type MyAgentTemplatesData = MyAgentTemplatesQuery["myAgentTemplates"]
/** The answer of the marketplaceListings operation. */
export type MarketplaceListingsData = MarketplaceListingsQuery["marketplaceListings"]
/** The answer of the templateUpdateOffers operation. */
export type TemplateUpdateOffersData = TemplateUpdateOffersQuery["templateUpdateOffers"]
/** The answer of the agentTemplatePreview operation. */
export type AgentTemplatePreviewData = AgentTemplatePreviewQuery["agentTemplatePreview"]
/** The answer of the packageAgentTemplate operation. */
export type PackageAgentTemplateData = PackageAgentTemplateMutation["packageAgentTemplate"]
/** The answer of the importAgentTemplate operation. */
export type ImportAgentTemplateData = ImportAgentTemplateMutation["importAgentTemplate"]
/** The answer of the installTemplateListing operation. */
export type InstallTemplateListingData = InstallTemplateListingMutation["installTemplateListing"]
/** The answer of the orderTemplateListing operation. */
export type OrderTemplateListingData = OrderTemplateListingMutation["orderTemplateListing"]
/** The answer of the acceptTemplateUpdate operation. */
export type AcceptTemplateUpdateData = AcceptTemplateUpdateMutation["acceptTemplateUpdate"]
/** The answer of the submitTemplateListing operation. */
export type SubmitTemplateListingData = SubmitTemplateListingMutation["submitTemplateListing"]
