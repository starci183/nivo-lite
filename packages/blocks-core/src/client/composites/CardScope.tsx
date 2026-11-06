import { createContext, useContext } from "react"
import type { ReactNode } from "react"

const Scope = createContext(false)

/** Marks the blocks under it as drawn inside a surface card that is already there. */
export const CardScopeProvider: (props: { readonly children: ReactNode }) => ReactNode = (props) => (
    <Scope.Provider value>{props.children}</Scope.Provider>
)

/** Whether the block sits in a surface card that is already drawn; false when the block draws its own surface. */
export const useInCard = (): boolean => useContext(Scope)
