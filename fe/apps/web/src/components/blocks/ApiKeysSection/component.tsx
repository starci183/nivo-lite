import { Alert, AlertDialog, Badge, Button, Input, List, ListItem, SurfaceCard, Text } from "@starci/grammar/common"
import {
    ACTIONS_CLASS,
    FIELD_GROW_CLASS,
    FORM_ROW_CLASS,
    KEY_LIST_CLASS,
    KEY_MAIN_CLASS,
    KEY_ROW_CLASS,
    STACK_CLASS,
} from "./classNames"

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
        readonly createError?: string
        readonly fresh?: {
            readonly title: string
            readonly warning: string
            readonly value: string
            readonly copyLabel: string
            readonly copiedLabel: string
            readonly doneLabel: string
        }
        readonly loadError?: { readonly title: string }
        readonly emptyLabel?: string
        readonly revokeLabel: string
        readonly revokeError?: string
        readonly items: ReadonlyArray<ApiKeyRowView>
        readonly revoking?: {
            readonly title: string
            readonly confirmLabel: string
            readonly cancelLabel: string
            readonly isPending: boolean
        }
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

/** Draws the API keys card: create a key (shown once), then the list with revoke confirmed through a dialog. */
export const ApiKeysSectionBase = (props: ApiKeysSectionBaseProps) => (
    <SurfaceCard label={props.props.title} headingLevel={2}>
        <div className={STACK_CLASS}>
            <Text size="sm" tone="muted">
                {props.props.body}
            </Text>
            <div className={FORM_ROW_CLASS}>
                <div className={FIELD_GROW_CLASS}>
                    <Input
                        id="api-key-name"
                        name="keyName"
                        label={props.props.nameLabel}
                        variant="secondary"
                        placeholder={props.props.nameHint}
                        isDisabled={props.props.isCreating}
                        value={props.props.nameValue}
                        onValueChange={props.on.changeName}
                    />
                </div>
                <Button
                    variant="primary"
                    isPending={props.props.isCreating}
                    isDisabled={props.props.isCreateDisabled}
                    onPress={props.on.create}
                >
                    {props.props.createLabel}
                </Button>
            </div>
            {props.props.createError === undefined ? null : <Alert tone="negative" title={props.props.createError} />}
            {props.props.fresh === undefined ? null : (
                <SurfaceCard depth="nested" label={props.props.fresh.title} headingLevel={3}>
                    <div className={STACK_CLASS}>
                        <Alert tone="cautionary" title={props.props.fresh.warning} />
                        <Input
                            id="api-key-fresh"
                            name="apiKey"
                            label={props.props.fresh.title}
                            variant="secondary"
                            value={props.props.fresh.value}
                            isReadOnly
                            isCopyable
                            copyLabel={props.props.fresh.copyLabel}
                            copiedLabel={props.props.fresh.copiedLabel}
                        />
                        <div>
                            <Button variant="outline" onPress={props.on.dismissFresh}>
                                {props.props.fresh.doneLabel}
                            </Button>
                        </div>
                    </div>
                </SurfaceCard>
            )}
            {props.props.loadError === undefined ? null : <Alert tone="negative" title={props.props.loadError.title} />}
            {props.props.emptyLabel === undefined ? null : (
                <Text size="sm" tone="muted">
                    {props.props.emptyLabel}
                </Text>
            )}
            {props.props.revokeError === undefined ? null : <Alert tone="negative" title={props.props.revokeError} />}
            {props.props.items.length === 0 ? null : renderApiKeysList(props)}
            {props.props.revoking === undefined ? null : (
                <AlertDialog
                    isOpen
                    onOpenChange={props.on.cancelRevoke}
                    title={props.props.revoking.title}
                    tone="negative"
                    confirmLabel={props.props.revoking.confirmLabel}
                    cancelLabel={props.props.revoking.cancelLabel}
                    isConfirmPending={props.props.revoking.isPending}
                    onConfirm={props.on.confirmRevoke}
                    onCancel={props.on.cancelRevoke}
                />
            )}
        </div>
    </SurfaceCard>
)

/** Draws the List section of the ApiKeysSection view. */
const renderApiKeysList = (props: ApiKeysSectionBaseProps) => (
    <List className={KEY_LIST_CLASS} label={props.props.title}>
        {props.props.items.map((item) => (
            <ListItem key={item.id} className={KEY_ROW_CLASS}>
                <div className={KEY_MAIN_CLASS}>
                    <Text weight="semibold">{item.name}</Text>
                    <Text size="sm" tone="muted">
                        {item.prefixText}
                    </Text>
                    <Text size="xs" tone="muted">
                        {item.datesText}
                    </Text>
                </div>
                <div className={ACTIONS_CLASS}>
                    <Badge isDot tone={item.isRevoked ? "neutral" : "success"}>
                        {item.statusLabel}
                    </Badge>
                    {item.isRevoked ? null : (
                        <Button variant="danger-soft" onPress={() => props.on.askRevoke(item.id)}>
                            {props.props.revokeLabel}
                        </Button>
                    )}
                </div>
            </ListItem>
        ))}
    </List>
)
