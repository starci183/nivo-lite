"use client"

import { useContactsView } from "@/hooks/contacts"
import { ContactsPanesBase } from "./component"

/** What the contacts block takes from the route: the person the address names, none on the list itself. */
interface ContactsPanesProps {
    readonly contactId: string | null | undefined
}

/** Reads the people and the open one, words them and builds the commands; the pure half draws the page. */
export const ContactsPanes = (props: ContactsPanesProps) => {
    const view = useContactsView(props.contactId)
    return <ContactsPanesBase props={view.props} on={view.on} />
}
