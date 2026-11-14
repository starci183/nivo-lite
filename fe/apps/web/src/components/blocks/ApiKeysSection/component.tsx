import { Alert, AlertDialog, Button, Code, EmptyNotice, SurfaceCard, type ListRowData } from "@starci/grammar/common"

import { nivoIconSource } from "@/components/leaves/Icon"
import type { ApiKeyRowView } from "@/modules/types"
import { CreateKeyDrawer, RenameKeyDrawer, type CreateKeyDrawerView, type RenameKeyDrawerView } from "./drawers"
import { FreshKeyDialog, type FreshKeyView } from "./FreshKeyDialog"

/** Props for {@link ApiKeysSectionBase}. */
export interface ApiKeysSectionBaseProps {
    readonly props: {
        readonly title: string
        readonly createLabel: string
        readonly isLoading: boolean
        readonly loadError?: { readonly title: string } | undefined
        readonly emptyLabel: string
        readonly revokeLabel: string
        readonly renameLabel: string
        readonly revokeError?: string | undefined
        readonly items: ReadonlyArray<ApiKeyRowView>
        readonly drawer: CreateKeyDrawerView
        readonly fresh?: FreshKeyView | undefined
        readonly renaming?: RenameKeyDrawerView | undefined
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
        readonly openCreate: () => void
        readonly closeCreate: () => void
        readonly changeName: (value: string) => void
        readonly changeKind: (value: string) => void
        readonly changeScope: (value: string) => void
        readonly submit: () => void
        readonly dismissFresh: () => void
        readonly copySnippet: (code: string) => void
        readonly askRename: (id: string) => void
        readonly changeRename: (value: string) => void
        readonly submitRename: () => void
        readonly closeRename: () => void
        readonly askRevoke: (id: string) => void
        readonly cancelRevoke: () => void
        readonly confirmRevoke: () => void
    }
}

/** The list rows: icon, name, kind and scope, dates and state; a live key has a menu to rename or revoke it. */
const itemsOf = (
    view: ApiKeysSectionBaseProps["props"],
    on: ApiKeysSectionBaseProps["on"],
): ReadonlyArray<ListRowData> =>
    view.items.map((item) => ({
        id: item.id,
        leading: { icon: nivoIconSource("password", "leading") },
        title: item.name,
        description: (
            <>
                {item.kindLabel} · {item.scopeText}
                <br />
                {item.prefixLead} <Code>{item.prefixCode}</Code> · {item.detailText}
            </>
        ),
        badges: [
            {
                label: item.statusLabel,
                tone: item.isRevoked || item.isInactive ? ("neutral" as const) : ("success" as const),
                isDot: true,
            },
        ],
        ...(item.isRevoked
            ? {}
            : {
                  menu: {
                      label: item.name,
                      entries: [
                          { id: "rename", label: view.renameLabel, onAction: () => on.askRename(item.id) },
                          {
                              id: "revoke",
                              label: view.revokeLabel,
                              tone: "danger" as const,
                              onAction: () => on.askRevoke(item.id),
                          },
                      ],
                  },
              }),
    }))

/** Draws the keys: the list (the one create command at its foot, a menu per live key), the create and rename drawers, the shown-once dialog and the revoke confirmation. */
export const ApiKeysSectionBase = (props: ApiKeysSectionBaseProps) => {
    const view = props.props
    const on = props.on
    return (
        <>
            <SurfaceCard
                kind="list"
                label={view.title}
                headingLevel={2}
                count={view.items.length}
                isLoading={view.isLoading}
                items={itemsOf(view, on)}
                empty={<EmptyNotice message={view.emptyLabel} iconSource={nivoIconSource("password", "leading")} />}
                footers={[
                    {
                        kind: "custom",
                        children: (
                            <Button intent="commit" startGlyph="plus" onPress={on.openCreate}>
                                {view.createLabel}
                            </Button>
                        ),
                    },
                ]}
            />
            {view.loadError === undefined ? null : <Alert tone="negative" title={view.loadError.title} />}
            {view.revokeError === undefined ? null : <Alert tone="negative" title={view.revokeError} />}
            <CreateKeyDrawer
                drawer={view.drawer}
                on={{
                    close: on.closeCreate,
                    changeName: on.changeName,
                    changeKind: on.changeKind,
                    changeScope: on.changeScope,
                    submit: on.submit,
                }}
            />
            {view.renaming === undefined ? null : (
                <RenameKeyDrawer
                    drawer={view.renaming}
                    on={{ close: on.closeRename, changeName: on.changeRename, submit: on.submitRename }}
                />
            )}
            {view.fresh === undefined ? null : (
                <FreshKeyDialog fresh={view.fresh} on={{ dismiss: on.dismissFresh, copySnippet: on.copySnippet }} />
            )}
            {view.revoking === undefined ? null : (
                <AlertDialog
                    isOpen
                    onOpenChange={on.cancelRevoke}
                    title={view.revoking.title}
                    tone="negative"
                    confirmLabel={view.revoking.confirmLabel}
                    cancelLabel={view.revoking.cancelLabel}
                    isConfirmPending={view.revoking.isPending}
                    onConfirm={on.confirmRevoke}
                    onCancel={on.cancelRevoke}
                />
            )}
        </>
    )
}
