"use client"

import { useQueryBrainTodoSwr } from "@/hooks/swr"

/**
 * What needs the owner: fact cards waiting, customer questions and proposals, as the one number the tab and the
 * rail show. The back end counts it; nothing here reads the lists, so every console page can ask.
 */
export const useBrainTodoCount = (): number => useQueryBrainTodoSwr().data?.total ?? 0
