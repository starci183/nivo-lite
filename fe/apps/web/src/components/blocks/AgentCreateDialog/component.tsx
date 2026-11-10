import { Button, Cluster, Dialog, Field, Form, Input, Select, Stack, type ListOption } from "@starci/grammar/common"
import { AvatarEditor } from "@/components/composites/AvatarEditor"
import { AgentMark } from "@/components/leaves/AgentMark"
import { ProvidersChoice, StartChoice, type ProvidersFieldView, type StartFieldView } from "./choices"

export type { ProvidersFieldView, StartFieldView } from "./choices"

/** The picture of the new agent as the preview draws it. */
export interface PicturePreviewView {
    readonly name: string
    readonly seed: string
    /** The image; null draws the initials. */
    readonly src: string | null
}

/** The words of the picture editor (the upload pill, what is accepted, a refusal). */
export interface PictureEditorView {
    readonly label: string
    readonly pickLabel: string
    readonly hint: string
    readonly accept: string
    readonly error?: string | undefined
    readonly removeLabel: string
    readonly canRemove: boolean
    readonly isBusy: boolean
}

/** One text field of the dialog. */
export interface TextFieldView {
    readonly label: string
    readonly description: string
    readonly value: string
}

/** The role picker, shown when the role is not known yet. */
export interface RoleFieldView {
    readonly label: string
    readonly placeholder: string
    readonly options: ReadonlyArray<ListOption>
    readonly value: string | null
}

/** The picture field. */
export interface PictureFieldView {
    readonly label: string
    readonly preview: PicturePreviewView
    readonly editor: PictureEditorView
}

/** Copy, values and choices of the create dialog. */
export interface AgentCreateDialogBaseProps {
    readonly props: {
        readonly isOpen: boolean
        readonly title: string
        readonly closeLabel: string
        /** The role picker; null when the role is known already ("+ Add Sales"). */
        readonly role: RoleFieldView | null
        readonly name: TextFieldView
        readonly handle: TextFieldView
        readonly picture: PictureFieldView
        /** The provider cards the template attaches; null while the role is not chosen. */
        readonly providers: ProvidersFieldView | null
        /** Null while the role has no agent whose setup could be copied. */
        readonly start: StartFieldView | null
        readonly submitLabel: string
        readonly cancelLabel: string
        readonly failTitle: string
        readonly isPending: boolean
    }
    readonly on: {
        readonly close: () => void
        readonly role: (value: string | null) => void
        readonly name: (value: string) => void
        readonly handle: (value: string) => void
        readonly upload: (files: Array<File>) => void
        readonly removeUpload: () => void
        readonly start: (value: string) => void
        readonly submit: () => void
    }
}

/** The name its customers see, with the handle derived from it under it. */
const NameFields = (props: AgentCreateDialogBaseProps) => (
    <Stack gap="row">
        <Input
            id="agent-create-name"
            name="name"
            label={props.props.name.label}
            description={props.props.name.description}
            value={props.props.name.value}
            isRequired
            onValueChange={props.on.name}
        />
        <Input
            id="agent-create-handle"
            name="handle"
            label={props.props.handle.label}
            description={props.props.handle.description}
            value={props.props.handle.value}
            onValueChange={props.on.handle}
        />
    </Stack>
)

/** The picture: the title above, the current avatar (Sprout until an upload) with the upload button and what happens without one. */
const PictureField = (props: AgentCreateDialogBaseProps) => {
    const view = props.props.picture
    return (
        <Field
            label={view.label}
            control={() => (
                <AvatarEditor
                    preview={
                        <AgentMark
                            label={view.preview.name}
                            seed={view.preview.seed}
                            src={view.preview.src}
                            size="lg"
                        />
                    }
                    {...view.editor}
                    isRemoveCompact
                    isLoading={false}
                    onPick={props.on.upload}
                    onRemove={props.on.removeUpload}
                />
            )}
        />
    )
}

/**
 * Draws the create dialog of the agents page: the role (when it is not known yet), the name its customers see and the handle under
 * it, the picture, the providers it is attached to (by its template) and where its setup starts, then the one create button.
 */
export const AgentCreateDialogBase = (props: AgentCreateDialogBaseProps) => {
    const view = props.props
    return (
        <Dialog
            isOpen={view.isOpen}
            onOpenChange={(isOpen) => (isOpen ? undefined : props.on.close())}
            size="md"
            title={view.title}
            closeLabel={view.closeLabel}
            footer={
                <Cluster gap="inline" justify="end">
                    <Button intent="neutral" isDisabled={view.isPending} onPress={props.on.close}>
                        {view.cancelLabel}
                    </Button>
                    <Button intent="commit" startGlyph="plus" isPending={view.isPending} onPress={props.on.submit}>
                        {view.submitLabel}
                    </Button>
                </Cluster>
            }
        >
            <Form label={view.title} onSubmit={props.on.submit} isPending={view.isPending}>
                <Stack gap="row">
                    <PictureField {...props} />
                    {view.role === null ? null : <Select {...view.role} isRequired onValueChange={props.on.role} />}
                    <NameFields {...props} />
                    {view.providers === null ? null : <ProvidersChoice view={view.providers} />}
                    {view.start === null ? null : <StartChoice view={view.start} onChange={props.on.start} />}
                </Stack>
            </Form>
        </Dialog>
    )
}
