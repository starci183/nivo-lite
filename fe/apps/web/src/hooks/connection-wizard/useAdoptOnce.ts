import { useState } from "react"

/**
 * Hands each new answer of a read to `adopt` exactly once, while rendering (derived state), never from an effect: a wizard
 * resuming a stored connection copies it into its own drafts the moment it arrives.
 */
export const useAdoptOnce = <T>(data: T | undefined, adopt: (data: T) => void) => {
    const [adopted, setAdopted] = useState<T | undefined>(undefined)
    if (data !== undefined && data !== adopted) {
        setAdopted(data)
        adopt(data)
    }
}
