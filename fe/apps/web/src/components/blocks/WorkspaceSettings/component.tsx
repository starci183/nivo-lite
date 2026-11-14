import {
    Alert,
    AlertDialog,
    Button,
    Cluster,
    ComboBox,
    Form,
    Input,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AvatarEditor } from "@/components/composites/AvatarEditor"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Copy, values and state the connected workspace settings block supplies. */
export interface WorkspaceSettingsBaseProps {
    readonly props: {
        /** The workspace's id: the generated mark when there is no logo. */
        readonly seed: string | undefined
        readonly detailsTitle: string
        readonly name: string
        readonly nameLabel: string
        readonly nameHint: string
        readonly nameError?: string | undefined
        readonly timeZone: string
        readonly timeZoneLabel: string
        readonly timeZoneHint: string
        readonly timeZonePlaceholder: string
        readonly timeZoneEmpty: string
        readonly timeZoneError?: string | undefined
        readonly timeZones: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly saveLabel: string
        readonly failTitle: string
        readonly isPending: boolean
        /** Owner and manager change the settings; everyone else reads them. */
        readonly canEdit: boolean
        readonly readOnlyNote: string
        readonly logoTitle: string
        /** The live preview: the chosen picture while it uploads, else the saved logo, else none. */
        readonly picture: string | null
        readonly logo: {
            readonly label: string
            readonly pickLabel: string
            readonly hint: string
            readonly accept: string
            readonly error?: string | undefined
            readonly removeLabel: string
            readonly canRemove: boolean
            readonly isBusy: boolean
        }
        /** The question asked before the logo is removed; none while the logo stays. */
        readonly confirmRemove?:
            | {
                  readonly title: string
                  readonly body: string
                  readonly cancelLabel: string
                  readonly isPending: boolean
              }
            | undefined
        /** The settings read: both cards draw once it arrived. */
        readonly slot: DataSlot<true>
        readonly labels: SlotLabels
        readonly error?: string | undefined
    }
    readonly on: {
        readonly setName: (value: string) => void
        readonly setTimeZone: (value: string) => void
        readonly submit: () => void
        readonly pick: (files: Array<File>) => void
        readonly askRemove: () => void
        readonly cancelRemove: () => void
        readonly remove: () => void
        readonly retry: () => void
    }
}

/** What a card of the block draws: the block's props and whether the settings read is still waiting. */
type CardProps = WorkspaceSettingsBaseProps & { readonly isSkeleton: boolean }

/** What the save command needs. */
interface SaveFootProps {
    readonly label: string
    readonly isPending: boolean
    readonly isSkeleton: boolean
}

/** The one save command, at the end of the details card's foot. */
const SaveFoot = (props: SaveFootProps) => (
    <Cluster gap="row" justify="end">
        <Button
            type="submit"
            form="workspace-settings-form"
            intent="commit"
            startGlyph="success"
            isPending={props.isPending}
            isLoading={props.isSkeleton}
        >
            {props.label}
        </Button>
    </Cluster>
)

/** The name and the time zone, each a field of the form; read-only for a member who cannot change them. */
const DetailsForm = (props: CardProps) => {
    const isLocked = props.props.isPending || !props.props.canEdit
    return (
        <Form
            id="workspace-settings-form"
            label={props.props.detailsTitle}
            onSubmit={props.on.submit}
            isPending={props.props.isPending}
        >
            <Stack gap="row">
                <Input
                    id="workspace-name"
                    name="name"
                    label={props.props.nameLabel}
                    description={props.props.nameHint}
                    isRequired
                    isDisabled={isLocked}
                    isLoading={props.isSkeleton}
                    value={props.isSkeleton ? "" : props.props.name}
                    onValueChange={props.on.setName}
                    {...(props.props.nameError === undefined ? {} : { errorMessage: props.props.nameError })}
                />
                <ComboBox
                    id="workspace-time-zone"
                    name="timeZone"
                    label={props.props.timeZoneLabel}
                    description={props.props.timeZoneHint}
                    placeholder={props.props.timeZonePlaceholder}
                    emptyState={props.props.timeZoneEmpty}
                    isRequired
                    isDisabled={isLocked}
                    isLoading={props.isSkeleton}
                    options={props.props.timeZones}
                    value={props.isSkeleton ? null : props.props.timeZone}
                    onValueChange={(value) => {
                        if (value !== null) props.on.setTimeZone(value)
                    }}
                    {...(props.props.timeZoneError === undefined ? {} : { errorMessage: props.props.timeZoneError })}
                />
                {props.props.canEdit ? null : (
                    <Text size="xs" tone="muted">
                        {props.props.readOnlyNote}
                    </Text>
                )}
                {props.props.error === undefined ? null : (
                    <Alert tone="negative" title={props.props.failTitle} description={props.props.error} />
                )}
            </Stack>
        </Form>
    )
}

/** What the logo preview draws. */
interface LogoPreviewProps {
    readonly name: string
    readonly seed: string | undefined
    readonly picture: string | null
    readonly isSkeleton: boolean
}

/** The logo's live preview: the chosen picture, else the saved logo, else the generated mark; geometry while the read waits. */
const LogoPreview = (props: LogoPreviewProps) => (
    <PersonAvatar
        name={props.isSkeleton ? "" : props.name}
        seed={props.isSkeleton ? undefined : props.seed}
        src={props.isSkeleton ? null : props.picture}
        size="lg"
        isLoading={props.isSkeleton}
    />
)

/** The confirmation of removing the logo: it says what follows. */
const RemoveDialog = (props: WorkspaceSettingsBaseProps) => {
    const confirm = props.props.confirmRemove
    if (confirm === undefined) return null
    return (
        <AlertDialog
            isOpen
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.cancelRemove()
            }}
            title={confirm.title}
            description={confirm.body}
            tone="negative"
            cancelLabel={confirm.cancelLabel}
            confirmLabel={props.props.logo.removeLabel}
            isConfirmPending={confirm.isPending}
            onConfirm={props.on.remove}
        />
    )
}

/** The logo card: the picker and the remove pill for a member who can change it, the picture alone for everyone else. */
const LogoCard = (props: CardProps) => {
    const preview = (
        <LogoPreview
            name={props.props.name}
            seed={props.props.seed}
            picture={props.props.picture}
            isSkeleton={props.isSkeleton}
        />
    )
    return (
        <SurfaceCard label={props.props.logoTitle} headingLevel={2} isLoading={props.isSkeleton}>
            {props.props.canEdit ? (
                <AvatarEditor
                    preview={preview}
                    {...props.props.logo}
                    isLoading={props.isSkeleton}
                    onPick={props.on.pick}
                    onRemove={props.on.askRemove}
                />
            ) : (
                preview
            )}
            <RemoveDialog {...props} />
        </SurfaceCard>
    )
}

/**
 * Draws the workspace settings as two cards: the name and the time zone with the one save command in the foot (no command for a
 * member who cannot change them), then the logo, which saves as soon as it is uploaded or removed. Both are geometry while the
 * settings load.
 */
export const WorkspaceSettingsBase = (props: WorkspaceSettingsBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder
        labels={props.props.labels}
        onRetry={props.on.retry}
        render={(_, isSkeleton) => (
            <Stack gap="region">
                <SurfaceCard
                    label={props.props.detailsTitle}
                    headingLevel={2}
                    isLoading={isSkeleton}
                    {...(props.props.canEdit
                        ? {
                              footers: [
                                  {
                                      kind: "custom" as const,
                                      children: (
                                          <SaveFoot
                                              label={props.props.saveLabel}
                                              isPending={props.props.isPending}
                                              isSkeleton={isSkeleton}
                                          />
                                      ),
                                  },
                              ],
                          }
                        : {})}
                >
                    <DetailsForm {...props} isSkeleton={isSkeleton} />
                </SurfaceCard>
                <LogoCard {...props} isSkeleton={isSkeleton} />
            </Stack>
        )}
    />
)
