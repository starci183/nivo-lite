"use client"

import { useInboxPage } from "@/hooks/inbox"
import { InboxFeedBase } from "./component"

/** Reads the customers of the inbox and the opened one, localizes them and revalidates on demand; the choices of the list and the phone pane live in the hook. */
export const InboxFeed = () => {
    const page = useInboxPage()
    return <InboxFeedBase props={page.props} on={page.on} />
}
