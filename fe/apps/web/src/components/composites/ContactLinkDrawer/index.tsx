import { Input, SurfaceCard } from "@starci/grammar/common"
import { ContactFormDrawer, contactFormDrawerPropsOf } from "@/components/branches/ContactFormDrawer"
import type { ContactLinkView, ContactsPanesCopy } from "@/modules/types"

/** What the link drawer draws and does. */
interface ContactLinkDrawerProps {
    readonly view: ContactLinkView
    readonly copy: ContactsPanesCopy["link"]
    readonly cancelLabel: string
    readonly closeLabel: string
    readonly on: {
        readonly close: () => void
        readonly setKind: (value: string) => void
        readonly setValue: (value: string) => void
        readonly submit: () => void
    }
}

/** The drawer that links a phone or an e-mail to a person: the kind as a choice list, the value, and what linking means. */
export const ContactLinkDrawer = (props: ContactLinkDrawerProps) => (
    <ContactFormDrawer
        {...contactFormDrawerPropsOf({
            id: "contact-link-form",
            description: props.copy.hint,
            view: props.view,
            copy: props.copy,
            labels: { cancel: props.cancelLabel, close: props.closeLabel },
            on: props.on,
        })}
        fields={
            <>
                <SurfaceCard
                    kind="select"
                    sublabel={props.copy.kindLabel}
                    selectionMode="single"
                    value={props.view.kind}
                    onChange={props.on.setKind}
                    items={[
                        { id: "phone", title: props.copy.kindPhone, isDisabled: props.view.isPending },
                        { id: "email", title: props.copy.kindEmail, isDisabled: props.view.isPending },
                    ]}
                />
                <Input
                    id="contact-link-value"
                    name="value"
                    kind={props.view.kind === "email" ? "email" : "tel"}
                    label={props.copy.valueLabel}
                    isRequired
                    isDisabled={props.view.isPending}
                    value={props.view.value}
                    onValueChange={props.on.setValue}
                />
            </>
        }
    />
)
