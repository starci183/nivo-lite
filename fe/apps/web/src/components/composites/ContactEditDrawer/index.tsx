import { Input } from "@starci/grammar/common"
import { ContactFormDrawer, contactFormDrawerPropsOf } from "@/components/branches/ContactFormDrawer"
import type { ContactEditView, ContactsPanesCopy } from "@/modules/types"

/** What the edit drawer draws and does. */
interface ContactEditDrawerProps {
    readonly view: ContactEditView
    readonly copy: ContactsPanesCopy["edit"]
    readonly cancelLabel: string
    readonly closeLabel: string
    readonly on: {
        readonly close: () => void
        readonly setName: (value: string) => void
        readonly setTags: (value: string) => void
        readonly submit: () => void
    }
}

/** The drawer that edits the name and the tags of a person, with a failure in place. */
export const ContactEditDrawer = (props: ContactEditDrawerProps) => (
    <ContactFormDrawer
        {...contactFormDrawerPropsOf({
            id: "contact-edit-form",
            view: props.view,
            copy: props.copy,
            labels: { cancel: props.cancelLabel, close: props.closeLabel },
            on: props.on,
        })}
        fields={
            <>
                <Input
                    id="contact-edit-name"
                    name="name"
                    label={props.copy.nameLabel}
                    isDisabled={props.view.isPending}
                    value={props.view.name}
                    onValueChange={props.on.setName}
                />
                <Input
                    id="contact-edit-tags"
                    name="tags"
                    label={props.copy.tagsLabel}
                    description={props.copy.tagsHint}
                    isDisabled={props.view.isPending}
                    value={props.view.tags}
                    onValueChange={props.on.setTags}
                />
            </>
        }
    />
)
