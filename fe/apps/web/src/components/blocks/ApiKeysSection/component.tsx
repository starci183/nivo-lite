import {
    Alert,
    AlertDialog,
    Button,
    Cluster,
    EmptyNotice,
    Input,
    Stack,
    SurfaceCard,
} from "@starci/grammar/common"

import { nivoIconSource } from "@/components/leaves/Icon"
import { FIELD_GROW_CLASS } from "./classNames"

/** One key row, already in the reader's words. */
export interface ApiKeyRowView {
    readonly id: string
    readonly name: string
    readonly prefixText: string
    readonly datesText: string
    readonly statusLabel: string
    readonly isRevoked: boolean
}

/** Props for {@link ApiKeysSectionBase}. */
export interface ApiKeysSectionBaseProps {
    readonly props: {
        readonly title: string
        readonly body: string
        readonly nameLabel: string
        readonly nameHint: string
        readonly nameValue: string
        readonly createLabel: string
        readonly isCreating: boolean
        readonly isCreateDisabled: boolean
        readonly createError?: string | undefined
        readonly fresh?:
            | {
                  readonly title: string
                  readonly warning: string
                  readonly value: string
                  readonly copyLabel: string
                  readonly copiedLabel: string
                  readonly doneLabel: string
              }
            | undefined
        readonly loadError?: { readonly title: string } | undefined
        readonly emptyLabel?: string | undefined
        readonly revokeLabel: string
        readonly revokeError?: string | undefined
        readonly items: ReadonlyArray<ApiKeyRowView>
        readonly revoking?:
            | {
                  readonly title: string
                  readonly confirmLabel: string
                  readonly cancelLabel: string
                  readonly isPending: boolean
              }
            | undefined
    }
    readonly on: {
        readonly changeName: (value: string) => void
        readonly create: () => void
        readonly dismissFresh: () => void
        readonly askRevoke: (id: string) => void
        readonly cancelRevoke: () => void
        readonly confirmRevoke: () => void
    }
}
/** The create form: the name of the key, the one command that makes it, and the failures that follow. */
const CreateKeyForm = (props: ApiKeysSectionBaseProps) => {
    const view = props.props
    return (
        <Stack gap="section">
            <Cluster gap="row" align="end">
                <div className={FIELD_GROW_CLASS}>
                    <Input
                        id="api-key-name"
                        name="keyName"
                        label={view.nameLabel}
                        isLabelHidden
                        placeholder={view.nameHint}
                        isDisabled={view.isCreating}
                        value={view.nameValue}
                        onValueChange={props.on.changeName}
                    />
                </div>
                <Button
                    intent="commit"
                    startGlyph="plus"
                    isPending={view.isCreating}
                    isDisabled={view.isCreateDisabled}
                    onPress={props.on.create}
                >
                    {view.createLabel}
                </Button>
            </Cluster>
            {view.createError === undefined ? null : <Alert tone="negative" title={view.createError} />}
            {view.loadError === undefined ? null : <Alert tone="negative" title={view.loadError.title} />}
            {view.revokeError === undefined ? null : <Alert tone="negative" title={view.revokeError} />}
        </Stack>
    )
}

/** The once-shown key and its exact copy/dismiss controls, as a card of its own, when a key was just created. */
const FreshKeyCard = (props: ApiKeysSectionBaseProps) => {
    const fresh = props.props.fresh
    if (fresh === undefined) return null
    return (
        <SurfaceCard ariaLabel={fresh.title}>
            <Stack gap="section">
                <Alert tone="cautionary" title={fresh.warning} />
                <Input
                    id="api-key-fresh"
                    name="apiKey"
                    label={fresh.title}
                    value={fresh.value}
                    isReadOnly
                    isCopyable
                    copyLabel={fresh.copyLabel}
                    copiedLabel={fresh.copiedLabel}
                />
                <div>
                    <Button intent="neutral" onPress={props.on.dismissFresh}>
                        {fresh.doneLabel}
                    </Button>
                </div>
            </Stack>
        </SurfaceCard>
    )
}

/** Draws the API keys card: create a key (shown once), then the list with revoke confirmed through a dialog. */
export const ApiKeysSectionBase = (props: ApiKeysSectionBaseProps) => {
    const view = props.props
    return (
        <>
            <FreshKeyCard {...props} />
            <SurfaceCard label={view.title} headingLevel={2} note={view.body}>
                <CreateKeyForm {...props} />
            </SurfaceCard>
            <SurfaceCard
                kind="list"
                ariaLabel={view.title}
                items={view.items.map((item) => ({
                    id: item.id,
                    leading: { icon: nivoIconSource("password", "leading") },
                    title: item.name,
                    description: `${item.prefixText} · ${item.datesText}`,
                    badges: [{ label: item.statusLabel, tone: item.isRevoked ? "neutral" : "success", isDot: true }],
                    ...(item.isRevoked
                        ? {}
                        : {
                              menu: {
                                  label: item.name,
                                  entries: [
                                      {
                                          id: "revoke",
                                          label: view.revokeLabel,
                                          tone: "danger",
                                          onAction: () => props.on.askRevoke(item.id),
                                      },
                                  ],
                              },
                          }),
                }))}
                empty={<EmptyNotice message={view.emptyLabel ?? view.title} iconSource={nivoIconSource("password", "leading")} />}
            />
            {view.revoking === undefined ? null : (
                <AlertDialog
                    isOpen
                    onOpenChange={props.on.cancelRevoke}
                    title={view.revoking.title}
                    tone="negative"
                    confirmLabel={view.revoking.confirmLabel}
                    cancelLabel={view.revoking.cancelLabel}
                    isConfirmPending={view.revoking.isPending}
                    onConfirm={props.on.confirmRevoke}
                    onCancel={props.on.cancelRevoke}
                />
            )}
        </>
    )
}
