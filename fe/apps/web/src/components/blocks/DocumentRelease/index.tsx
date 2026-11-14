"use client"

import { useDocumentRelease } from "@/hooks/brain"
import { DocumentReleaseBase } from "./component"

/** What the page tells the release card: the document of the address, or that the route still loads (the skeleton of the same card). */
interface DocumentReleaseProps {
    readonly sourceId?: string
    readonly isLoading?: boolean
}

/** The connected release card: what customers read of the document and what holds the rest; the owner serves what waits for the review. */
export const DocumentRelease = (props: DocumentReleaseProps) => {
    const release = useDocumentRelease(props)
    return <DocumentReleaseBase props={release.view} on={release.on} />
}
