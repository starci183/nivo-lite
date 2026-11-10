"use client"

import { useQueryMyWorkInHandSwr } from "@/hooks/swr"

/** How many open work items are assigned to the person in the workspace; undefined while it reads, or when no workspace is named. */
export const useLobbyWorkInHand = (workspaceId: string | undefined): number | undefined =>
    useQueryMyWorkInHandSwr(workspaceId).data
