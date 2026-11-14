"use client"

import { useQueryWorkspaceSettingsSwr } from "@/hooks/swr"

/**
 * The workspace logo for the top bar: the public address of the picture the owner or a manager uploaded on the settings page, or
 * null while it is unread or when the workspace has none (the top bar then draws Grammar's mark). It reads the same cached answer
 * as the settings page, so a saved or removed logo shows in the top bar at once.
 */
export const useWorkspaceLogo = (): string | null => useQueryWorkspaceSettingsSwr().data?.logoUrl ?? null
