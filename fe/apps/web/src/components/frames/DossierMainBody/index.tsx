import { Stack } from "@starci/grammar/common"
import {
    DossierFindingBoard,
    type DossierFindingsPane,
    type FindingAction,
} from "@/components/composites/DossierFindingBoard"
import {
    DossierFindingDialogs,
    type FindingDialogValues,
    type FindingDialogView,
} from "@/components/composites/DossierFindingDialogs"

/** The words of the findings of the open dossier. */
interface DossierMainBodyCopy {
    readonly statusLine: string
    readonly findingOptions: string
    readonly emptyFindings: string
    /** The name of the "+n" filter menu; `{count}` stands for how many tabs it holds. */
    readonly filtersMore: string
}

/** What the body of the open dossier says and calls. */
interface DossierMainBodyProps {
    readonly findings: DossierFindingsPane
    /** The task that gives the dossier to a member with a date; null while it is closed. */
    readonly ownerDialog: FindingDialogView | null
    readonly copy: DossierMainBodyCopy
    readonly isWaiting: boolean
    readonly onFilter: (value: string) => void
    readonly onAction: (findingId: string, action: FindingAction) => void
    readonly onLoadMore: () => void
    readonly onRetry: () => void
    readonly onSubmitDialog: (values: FindingDialogValues) => void
    readonly onCloseDialog: () => void
    readonly onSubmitOwner: (values: FindingDialogValues) => void
    readonly onCloseOwner: () => void
}

/** The findings of the open dossier, and the dialogs a command on one of them (or on the dossier) opens. */
export const DossierMainBody = (props: DossierMainBodyProps) => (
    <Stack gap="section">
        <DossierFindingBoard
            pane={props.findings}
            isLoading={props.isWaiting}
            copy={{
                statusLine: props.copy.statusLine,
                findingOptions: props.copy.findingOptions,
                emptyLabel: props.copy.emptyFindings,
                filtersMore: props.copy.filtersMore,
            }}
            onFilter={props.onFilter}
            onAction={props.onAction}
            onLoadMore={props.onLoadMore}
            onRetry={props.onRetry}
        />
        {props.ownerDialog === null ? null : (
            <DossierFindingDialogs
                props={props.ownerDialog}
                on={{ submit: props.onSubmitOwner, close: props.onCloseOwner }}
            />
        )}
        {props.findings.frame.dialog === null ? null : (
            <DossierFindingDialogs
                props={props.findings.frame.dialog}
                on={{ submit: props.onSubmitDialog, close: props.onCloseDialog }}
            />
        )}
    </Stack>
)
