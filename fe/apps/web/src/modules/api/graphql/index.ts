// The contract object types as the operations select them (the client preset emits operation results only,
// so each object type is read off the operation that selects most of its fields).
import type {
    AgentGenerationStatusQuery,
    AgentKnowledgeLensesQuery,
    CreditPacksBoughtQuery,
    AskKnowledgeQuery,
    BillingPlanQuery,
    BillingWorkspaceQuery,
    BrainQuery,
    PublicDocumentsQuery,
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
    KnowledgeSourceQuery,
    KnowledgeSourcesQuery,
    KnowledgeSuggestionsQuery,
    LessonMiningStatusQuery,
    ModuleInstallationsQuery,
    NivoKnowledgeQuery,
    RequestDataSyncMutation,
    ReturnZaloAuthorizationMutation,
    StartMoneyConnectionMutation,
    StartWebhookConnectionMutation,
    TestWebhookConnectionMutation,
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

/** The `AgentGenerationStatusType` object of the back end contract, as the operations of this app select it. */
export type AgentGenerationStatusType = AgentGenerationStatusQuery["agentGenerationStatus"]
/** The `CreditPackPurchaseType` object of the back end contract, as the operations of this app select it. */
export type CreditPackPurchaseType = CreditPacksBoughtQuery["creditPacksBought"][number]
/** The `BillingPlanType` object of the back end contract, as the operations of this app select it. */
export type BillingPlanType = NonNullable<BillingPlanQuery["billingPlan"]>
/** The `BillingWorkspaceType` object of the back end contract, as the operations of this app select it. */
export type BillingWorkspaceType = BillingWorkspaceQuery["billingWorkspace"]
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
/** The `RetrievedPassageType` object of the back end contract, as the operations of this app select it. */
export type RetrievedPassageType = AskKnowledgeQuery["askKnowledge"][number]
/** The `WebhookTestResultType` object of the back end contract, as the operations of this app select it. */
export type WebhookTestResultType = TestWebhookConnectionMutation["testWebhookConnection"]
/** The `WebhookViewType` object of the back end contract, as the operations of this app select it. */
export type WebhookViewType = StartWebhookConnectionMutation["startWebhookConnection"]
/** The `WizardConnectionType` object of the back end contract, as the operations of this app select it. */
export type WizardConnectionType = StartMoneyConnectionMutation["startMoneyConnection"]
/** The `ZaloWizardConnectionType` object of the back end contract, as the operations of this app select it. */
export type ZaloWizardConnectionType = ReturnZaloAuthorizationMutation["returnZaloAuthorization"]
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
