import type {
    ContentWorkbenchFields,
    ContentWorkbenchActions,
    ContentWorkbenchPanel,
    ContentCalendarCell,
    ContentBalanceFields,
    ContentBalanceActions,
    ContentCalendarFields,
    ContentCalendarActions,
    ContentListFields,
    ContentListActions,
    ContentQueueFields,
    ContentQueueActions,
    ContentTab,
    ContentWorkbenchView,
} from "./content-model-workbench"
import type { ContentWorkbenchCopy } from "./content-model-workbench-copy"
import type {
    AutomationKey,
    ContentAddPostFields,
    ContentAddPostActions,
    ContentAutomationFields,
    ContentAutomationActions,
    ContentBrandFields,
    ContentBrandActions,
    ContentCadenceFields,
    ContentCadenceActions,
    ContentPillarFields,
    ContentPillarActions,
    ContentPillarRow,
    ContentPlanFields,
    ContentPlanActions,
    ContentQuickIdeaFields,
    ContentQuickIdeaActions,
    ContentCadenceRow,
} from "./content-model-workbench-forms"
import type {
    ContentEditorAssetFields,
    ContentEditorFields,
    ContentEditorActions,
    ContentPublishProof,
    ContentEditorView,
} from "./content-model-workbench-editor"

/** Resolved read facts and words for the Content workbench. */
export interface ContentViews {
    readonly automationKey: AutomationKey
    readonly workbenchFields: ContentWorkbenchFields
    readonly workbenchPanel: ContentWorkbenchPanel
    readonly workbenchCopy: ContentWorkbenchCopy
    readonly calendarCell: ContentCalendarCell
    readonly addPostFields: ContentAddPostFields
    readonly automationFields: ContentAutomationFields
    readonly balanceFields: ContentBalanceFields
    readonly brandFields: ContentBrandFields
    readonly cadenceFields: ContentCadenceFields
    readonly calendarFields: ContentCalendarFields
    readonly editorAssetFields: ContentEditorAssetFields
    readonly editorFields: ContentEditorFields
    readonly pillarFields: ContentPillarFields
    readonly pillarRow: ContentPillarRow
    readonly planFields: ContentPlanFields
    readonly listFields: ContentListFields
    readonly queueFields: ContentQueueFields
    readonly quickIdeaFields: ContentQuickIdeaFields
    readonly publishProof: ContentPublishProof
    readonly cadenceRow: ContentCadenceRow
    readonly tab: ContentTab
}

/** Atomic commands owned by the connected world for the Content workbench. */
export interface ContentActions {
    readonly workbenchActions: ContentWorkbenchActions
    readonly addPostActions: ContentAddPostActions
    readonly automationActions: ContentAutomationActions
    readonly balanceActions: ContentBalanceActions
    readonly brandActions: ContentBrandActions
    readonly cadenceActions: ContentCadenceActions
    readonly calendarActions: ContentCalendarActions
    readonly editorActions: ContentEditorActions
    readonly pillarActions: ContentPillarActions
    readonly planActions: ContentPlanActions
    readonly listActions: ContentListActions
    readonly queueActions: ContentQueueActions
    readonly quickIdeaActions: ContentQuickIdeaActions
}

/** The connected world assembly for the Content workbench. */
export interface ContentAssembly {
    readonly editorView: ContentEditorView
    readonly workbenchView: ContentWorkbenchView
}
