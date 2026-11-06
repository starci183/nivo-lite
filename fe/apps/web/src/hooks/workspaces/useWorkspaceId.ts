"use client"

import { useParams } from "next/navigation"

/** What the address of a workspace page names. */
type WorkspaceParams = { readonly workspaceId: string }

/** The workspace the person works in: the first segment of the address, the one source of truth for every console page. */
export const useWorkspaceId = (): string => useParams<WorkspaceParams>().workspaceId
