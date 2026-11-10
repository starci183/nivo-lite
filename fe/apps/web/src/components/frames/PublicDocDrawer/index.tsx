import { AlertDialog, Button, Cluster, Drawer, DropdownMenu, IconButton } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PublicDraftBody } from "@/components/composites/PublicDraftBody"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { PublicBrainView, PublicDraftView } from "@/modules/types"

/** What the drawer of the open public document draws and calls. */
interface PublicDocDrawerProps {
    readonly props: PublicBrainView["props"]
    readonly on: PublicBrainView["on"]
}

/** What the decisions over the open document draw. */
interface DecisionsProps extends PublicDocDrawerProps {
    readonly draft: PublicDraftView
}

/** The archive command, in the menu and in the danger tone: it asks to be confirmed. */
const ArchiveMenu = (props: PublicDocDrawerProps) => (
    <DropdownMenu
        placement="top start"
        entries={[
            {
                id: "archive",
                label: props.props.copy.archiveLabel,
                tone: "danger",
                onAction: () => props.on.menu("archive"),
            },
        ]}
        trigger={
            <IconButton
                intent="neutral"
                source={nivoIconSource("more", "leading")}
                label={props.props.copy.moreActions}
            />
        }
    />
)

/** The decisions the owner takes over the open document: archive in the menu, then later, save, draft again, approve. */
const Decisions = (props: DecisionsProps) => {
    const { form, copy, canWrite } = props.props
    const { draft } = props
    const pending = form.pendingAction
    return (
        <Cluster gap="inline" justify="end">
            {canWrite ? <ArchiveMenu props={props.props} on={props.on} /> : null}
            <Button intent="alternative" isDisabled={form.isBusy} onPress={props.on.back}>
                {copy.laterLabel}
            </Button>
            {draft.canEdit ? (
                <Button intent="neutral" isPending={pending === "save"} onPress={props.on.save}>
                    {copy.saveLabel}
                </Button>
            ) : null}
            {draft.redraftLabel === null ? null : (
                <Button
                    intent="neutral"
                    isPending={pending === "redraft"}
                    onPress={props.on.redraft}
                >
                    {draft.redraftLabel}
                </Button>
            )}
            {draft.approveLabel === null ? null : (
                <Button intent="commit" isPending={pending === "approve"} onPress={props.on.approve}>
                    {draft.approveLabel}
                </Button>
            )}
        </Cluster>
    )
}

/**
 * The open public document as a drawer over the table: the text as an editable draft, the internal sources it came from, what NIVO
 * left out and who approved it, with the decisions at its foot (archive, later, save, draft again, approve and publish). It opens when
 * the address names a document, and its close goes back to the table.
 */
export const PublicDocDrawer = (props: PublicDocDrawerProps) => {
    const view = props.props
    const { main, opened, copy, decided } = view
    return (
        <>
            <Drawer
                isOpen={main.kind === "doc"}
                onOpenChange={(open) => {
                    if (!open) props.on.back()
                }}
                title={opened === null ? copy.listTitle : opened.draft.title}
                {...(opened === null ? {} : { description: opened.draft.meta })}
                closeLabel={copy.back}
                placement="right"
                width="wide"
                isLoading={view.isWaiting || (opened?.isLoading ?? false)}
                {...(decided === null ? {} : { footer: <Decisions props={view} on={props.on} draft={decided} /> })}
            >
                {main.kind === "doc" ? (
                    <SlotView
                        slot={main.slot}
                        placeholder={[view.placeholder]}
                        labels={view.slotLabels}
                        errorDescription={copy.errorBody}
                        errorLayout="band"
                        onRetry={props.on.retry}
                        render={(drafts, isLoading) =>
                            drafts.map((draft) => (
                                <PublicDraftBody
                                    key={draft.id}
                                    draft={draft}
                                    form={view.form}
                                    copy={copy}
                                    isLoading={isLoading}
                                    onTitle={props.on.setTitle}
                                    onBody={props.on.setBody}
                                    onSubmit={props.on.approve}
                                />
                            ))
                        }
                    />
                ) : null}
            </Drawer>
            {opened === null ? null : (
                <AlertDialog
                    isOpen={view.isRemoveOpen}
                    onOpenChange={props.on.removeOpenChange}
                    title={copy.archiveTitle(opened.draft.title)}
                    description={copy.archiveBody}
                    confirmLabel={copy.archiveLabel}
                    cancelLabel={copy.cancelLabel}
                    isConfirmPending={view.isRemoving}
                    onConfirm={props.on.remove}
                />
            )}
        </>
    )
}
