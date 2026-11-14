import { Alert, Button, Drawer, Form, Input, Stack, SurfaceCard } from "@starci/grammar/common"

/** One row of a choice list: its title and, when it has one, the line under it. */
interface ChoiceItem {
    readonly id: string
    readonly title: string
    readonly subtitle?: string
}

/** The create drawer: the short form and its state. */
export interface CreateKeyDrawerView {
    readonly isOpen: boolean
    readonly title: string
    readonly description: string
    readonly closeLabel: string
    readonly cancelLabel: string
    readonly submitLabel: string
    readonly nameLabel: string
    readonly nameHint: string
    readonly nameValue: string
    /** The kind choices (MCP key, public API key); empty for a member who may only make MCP keys: the choice is not drawn. */
    readonly kindLabel: string
    readonly kindItems: ReadonlyArray<ChoiceItem>
    readonly kindValue: string
    /** What the scope means for the chosen kind. */
    readonly scopeLabel: string
    /** The scope choices: no agent first, then the agents; empty when the member may not scope a key (the choice is not drawn). */
    readonly scopeItems: ReadonlyArray<ChoiceItem>
    readonly scopeValue: string
    readonly isPending: boolean
    readonly isSubmitDisabled: boolean
    readonly error?: string | undefined
}

/** The rename drawer: one field and the commit. */
export interface RenameKeyDrawerView {
    readonly title: string
    readonly closeLabel: string
    readonly cancelLabel: string
    readonly submitLabel: string
    readonly nameLabel: string
    readonly nameHint: string
    readonly nameValue: string
    readonly isPending: boolean
    readonly isSubmitDisabled: boolean
}

/** Props for {@link Choice}. */
interface ChoiceProps {
    readonly label: string
    readonly items: ReadonlyArray<ChoiceItem>
    readonly value: string
    readonly isDisabled: boolean
    readonly onChange: (value: string) => void
}

/** One single-choice list as a card of checkbox rows. */
const Choice = (props: ChoiceProps) =>
    props.items.length === 0 ? null : (
        <SurfaceCard
            kind="select"
            sublabel={props.label}
            selectionMode="single"
            value={props.value}
            onChange={props.onChange}
            items={props.items.map((item) => ({ ...item, isDisabled: props.isDisabled }))}
        />
    )

/** The create drawer's commands. */
interface CreateKeyDrawerProps {
    readonly drawer: CreateKeyDrawerView
    readonly on: {
        readonly close: () => void
        readonly changeName: (value: string) => void
        readonly changeKind: (value: string) => void
        readonly changeScope: (value: string) => void
        readonly submit: () => void
    }
}

/** The short create form in a drawer: the name, the kind and the scope as choice lists, the failure in place, cancel and the one command at the foot. */
export const CreateKeyDrawer = (props: CreateKeyDrawerProps) => {
    const drawer = props.drawer
    return (
        <Drawer
            isOpen={drawer.isOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.close()
            }}
            title={drawer.title}
            description={drawer.description}
            closeLabel={drawer.closeLabel}
            footer={
                <>
                    <Button intent="dismiss" isDisabled={drawer.isPending} onPress={props.on.close}>
                        {drawer.cancelLabel}
                    </Button>
                    <Button
                        type="submit"
                        form="api-key-form"
                        intent="commit"
                        isPending={drawer.isPending}
                        isDisabled={drawer.isSubmitDisabled}
                    >
                        {drawer.submitLabel}
                    </Button>
                </>
            }
        >
            <Form id="api-key-form" label={drawer.title} onSubmit={props.on.submit} isPending={drawer.isPending}>
                <Stack gap="row">
                    <Input
                        id="api-key-name"
                        name="keyName"
                        label={drawer.nameLabel}
                        placeholder={drawer.nameHint}
                        isRequired
                        isDisabled={drawer.isPending}
                        value={drawer.nameValue}
                        onValueChange={props.on.changeName}
                    />
                    <Choice
                        label={drawer.kindLabel}
                        items={drawer.kindItems}
                        value={drawer.kindValue}
                        isDisabled={drawer.isPending}
                        onChange={props.on.changeKind}
                    />
                    <Choice
                        label={drawer.scopeLabel}
                        items={drawer.scopeItems}
                        value={drawer.scopeValue}
                        isDisabled={drawer.isPending}
                        onChange={props.on.changeScope}
                    />
                    {drawer.error === undefined ? null : <Alert tone="negative" title={drawer.error} />}
                </Stack>
            </Form>
        </Drawer>
    )
}

/** The rename drawer's commands. */
interface RenameKeyDrawerProps {
    readonly drawer: RenameKeyDrawerView
    readonly on: {
        readonly close: () => void
        readonly changeName: (value: string) => void
        readonly submit: () => void
    }
}

/** The short rename form in a drawer: the name and the one commit. */
export const RenameKeyDrawer = (props: RenameKeyDrawerProps) => {
    const drawer = props.drawer
    return (
        <Drawer
            isOpen
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.close()
            }}
            title={drawer.title}
            closeLabel={drawer.closeLabel}
            footer={
                <>
                    <Button intent="dismiss" isDisabled={drawer.isPending} onPress={props.on.close}>
                        {drawer.cancelLabel}
                    </Button>
                    <Button
                        type="submit"
                        form="api-key-rename-form"
                        intent="commit"
                        isPending={drawer.isPending}
                        isDisabled={drawer.isSubmitDisabled}
                    >
                        {drawer.submitLabel}
                    </Button>
                </>
            }
        >
            <Form id="api-key-rename-form" label={drawer.title} onSubmit={props.on.submit} isPending={drawer.isPending}>
                <Input
                    id="api-key-rename"
                    name="keyRename"
                    label={drawer.nameLabel}
                    placeholder={drawer.nameHint}
                    isRequired
                    isDisabled={drawer.isPending}
                    value={drawer.nameValue}
                    onValueChange={props.on.changeName}
                />
            </Form>
        </Drawer>
    )
}
