import type { HiringViews, HiringActions } from "@/modules/types"

import { Alert, AlertDialog, Badge, Cluster, Drawer, Stack, Text } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { HiringCandidateSections } from "@/components/composites/HiringCandidateSections"
import { HiringScoreSection } from "@/components/composites/HiringScoreSection"
type HiringCandidateFrameProps = HiringViews["candidateFrameFields"] & {
    readonly cv: ReactNode
    readonly history: ReactNode
    readonly dialogs: ReactNode
    readonly on: HiringActions["candidateFrameActions"]
}

/** The candidate's ready regions keep the existing drawer order; independent read nodes come from its Base. */
const CandidateRegions = (props: HiringCandidateFrameProps) => (
    <>
        <HiringCandidateSections
            section="actions"
            copy={props.copy}
            canSchedule={props.canSchedule}
            canOffer={props.canOffer}
            canShortlist={props.canShortlist}
            canReject={props.canReject}
            isBusy={props.isBusy}
            on={{ openDialog: props.on.openDialog, shortlist: props.on.shortlist }}
        />{" "}
        <HiringScoreSection
            copy={props.copy}
            score={props.score}
            isBusy={props.isBusy}
            on={{ rescreen: props.on.rescreen }}
        />
        {props.cv}
        <HiringCandidateSections
            section="responses"
            copy={props.copy}
            answers={props.answers}
            interviews={props.interviews}
            offers={props.offers}
            isBusy={props.isBusy}
            on={{ cancelOffer: props.on.cancelOffer }}
        />
        <HiringCandidateSections
            section="records"
            copy={props.copy}
            notes={props.notes}
            canSaveNotes={props.canSaveNotes}
            history={props.history}
            retention={props.retention}
            isBusy={props.isBusy}
            on={{ notes: props.on.notes, saveNotes: props.on.saveNotes, delete: () => props.on.openDialog("delete") }}
        />{" "}
    </>
)

/** The original destructive confirmation remains a sibling of the drawer and shares its explicit close/reset. */
const DeleteConfirmation = (props: HiringCandidateFrameProps) =>
    props.isDeleteOpen ? (
        <AlertDialog
            isOpen
            onOpenChange={(open) => {
                if (!open) props.on.closeDialog()
            }}
            tone="negative"
            title={props.deleteTitle}
            description={props.copy.deleteBody}
            confirmLabel={props.copy.deleteConfirm}
            cancelLabel={props.copy.cancel}
            isConfirmPending={props.isBusy}
            onConfirm={props.on.remove}
        >
            <Text>{props.copy.deleteWhen}</Text>
        </AlertDialog>
    ) : null

/** The actual candidate drawer owns its ready layout; world reads and their notices stay in the module Base. */
export const HiringCandidateFrame = (props: HiringCandidateFrameProps) => {
    if (!props.isOpen) return null
    return (
        <>
            <Drawer
                isOpen
                onOpenChange={(open) => {
                    if (!open) props.on.close()
                }}
                title={props.name}
                description={props.subtitle}
                closeLabel={props.copy.close}
                placement="right"
            >
                <Stack gap="row">
                    {props.error === null ? null : (
                        <Alert
                            tone="negative"
                            title={props.copy.errorTitle}
                            description={props.error}
                            dismissLabel={props.copy.dismiss}
                            onDismiss={props.on.clear}
                        />
                    )}
                    {props.notice === null ? null : (
                        <Alert
                            tone="informative"
                            title={props.notice}
                            dismissLabel={props.copy.dismiss}
                            onDismiss={props.on.clear}
                        />
                    )}
                    <Cluster gap="inline">
                        <Badge tone={props.stageTone} isDot>
                            {props.stageLabel}
                        </Badge>
                        {props.contacts.map((line) => (
                            <Text key={line} as="span" size="sm">
                                {line}
                            </Text>
                        ))}
                    </Cluster>
                    <CandidateRegions {...props} />
                </Stack>
            </Drawer>
            {props.dialogs}
            <DeleteConfirmation {...props} />{" "}
        </>
    )
}
