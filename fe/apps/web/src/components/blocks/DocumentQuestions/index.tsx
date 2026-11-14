"use client"

import { useDocumentCritique } from "@/hooks/brain"
import { DocumentQuestionsBase } from "./component"

/** What the page tells the points block: the document of the address, or that the route still loads (the skeleton of the same cards). */
interface DocumentQuestionsProps {
    readonly sourceId?: string
    readonly isLoading?: boolean
}

/** The connected points of the document critic: one card per kind of doubt, answered with the buttons the back end built. */
export const DocumentQuestions = (props: DocumentQuestionsProps) => {
    const critique = useDocumentCritique(props)
    return <DocumentQuestionsBase props={critique.view} on={critique.on} />
}
