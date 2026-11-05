"use client"

import { useAppSelector } from "@/redux"

/**
 * Whether the viewer holds a permission, as far as the browser can know: the grants of a member live behind the door, which refuses
 * a read or an action the viewer may not run (the read turns forbidden, the action answers forbidden). So the browser answers yes to
 * a signed-in viewer, no to a signed-out one, and always yes for no permission.
 */
export const useWorkbenchCan = (permission: string | null): boolean => {
    const isSignedIn = useAppSelector((state) => typeof state.viewer.viewerId === "string")
    return permission === null || isSignedIn
}
