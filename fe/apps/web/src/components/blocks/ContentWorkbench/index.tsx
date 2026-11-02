"use client"

import { useContentWorkbenchView } from "@/hooks/contentWorkbench"
import { ContentWorkbenchBase } from "./component"

/** The route identity and server-resolved words of one content workbench. */
type ContentWorkbenchProps = Parameters<typeof useContentWorkbenchView>[0]

/** Owns the content workbench's actual reads, active surfaces and bound commands. */
export const ContentWorkbench = (props: ContentWorkbenchProps) => {
    const view = useContentWorkbenchView(props)
    return <ContentWorkbenchBase {...view} />
}
