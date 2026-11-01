"use client"

import useSWR from "swr"
import { useWorkspaceKey } from "@/hooks/workspaceKey"
import { answeredData } from "@/hooks/workspaceread"
import { queryBrainTodo } from "@/modules/api/graphql/queries/query-brain-todo"

/** The SWR key of the count of what needs the owner; a write that changes a finding, a fact or a question revalidates the keys that lead with it. */
export const QUERY_BRAIN_TODO_SWR_KEY = "QUERY_BRAIN_TODO_SWR"

/**
 * What needs the owner in the Second Brain, three counts computed by the back end (the `brainTodo` query). The rail, the page header and
 * the to-do tab read this one cached answer, so a console page asks for three counts and never for the lists; it is read again when a
 * write or a settled document changes what it counts.
 */
export const useQueryBrainTodoSwr = () => {
    const key = useWorkspaceKey(QUERY_BRAIN_TODO_SWR_KEY, [])
    return useSWR(
        key,
        async ({ signal }: { signal?: AbortSignal } = {}) =>
            answeredData(await queryBrainTodo({ signal }), "brainTodo").brainTodo,
    )
}
