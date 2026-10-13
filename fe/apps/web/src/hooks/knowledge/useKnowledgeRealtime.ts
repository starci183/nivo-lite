import { useEffect, useRef } from "react"
import { subscribeToWorkspaceChanges } from "@/modules/db/browser"

const REFRESH_DEBOUNCE_MS = 800

/** The tables whose changes the knowledge and brain pages follow. */
type FollowedTable = "knowledge_sources" | "brain_facts" | "brain_lessons" | "knowledge_gaps" | "brain_extractions"

/**
 * Calls `onChange` (debounced) when a document, a fact, a lesson, a customer question or the reading of a document changes in the
 * workspace: a worker moved a document on, an agent proposed a fact. The page then reads its data again.
 */
export const useKnowledgeRealtime = (
    workspaceId: string,
    tables: ReadonlyArray<FollowedTable>,
    onChange: () => void,
): void => {
    const latest = useRef(onChange)
    useEffect(() => {
        latest.current = onChange
    }, [onChange])
    const followed = tables.join(",")
    useEffect(() => {
        if (workspaceId === "") return
        let timer: ReturnType<typeof setTimeout> | undefined
        const stop = subscribeToWorkspaceChanges({
            channel: `knowledge-${workspaceId}-${followed}`,
            workspaceId,
            tables: followed.split(",").flatMap((table): ReadonlyArray<FollowedTable> => {
                const known = TABLES.find((one) => one === table)
                return known === undefined ? [] : [known]
            }),
            onChange: () => {
                clearTimeout(timer)
                timer = setTimeout(() => latest.current(), REFRESH_DEBOUNCE_MS)
            },
        })
        return () => {
            clearTimeout(timer)
            stop()
        }
    }, [workspaceId, followed])
}

const TABLES: ReadonlyArray<FollowedTable> = [
    "knowledge_sources",
    "brain_facts",
    "brain_lessons",
    "knowledge_gaps",
    "brain_extractions",
]
