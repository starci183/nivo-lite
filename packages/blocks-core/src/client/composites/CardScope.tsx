import { createContext, useContext, useEffect } from "react"
import type { ReactNode } from "react"
import type { FilterFields } from "@starci/grammar/common"

/** Where a pane's filter tabs are kept for the card that draws them in its header. */
export interface FilterStore {
    /** The filter the tabs block published; null while none is. */
    readonly get: () => FilterFields | null
    /** Publishes the filter, or null when the tabs block is gone. */
    readonly set: (filter: FilterFields | null) => void
    /** Calls `listener` whenever the filter changes; answers how to stop. */
    readonly subscribe: (listener: () => void) => () => void
}

/** A store of one filter, which a card header reads and a tabs block fills. */
export const createFilterStore = (): FilterStore => {
    let current: FilterFields | null = null
    const listeners = new Set<() => void>()
    return {
        get: () => current,
        set: (filter) => {
            current = filter
            listeners.forEach((listener) => listener())
        },
        subscribe: (listener) => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
    }
}

/** What a block inside a surface card is told: that the card is already drawn around it, and where its filter tabs go. */
export interface CardScope {
    /** The store the filter tabs publish to; null for a card whose header takes no filter. */
    readonly filters: FilterStore | null
}

const Scope = createContext<CardScope | null>(null)

/** Marks the blocks under it as drawn inside a surface card that is already there. */
export const CardScopeProvider: (props: { readonly value: CardScope; readonly children: ReactNode }) => ReactNode = (
    props,
) => <Scope.Provider value={props.value}>{props.children}</Scope.Provider>

/** The card the block sits in; null when the block draws its own surface. */
export const useCardScope = (): CardScope | null => useContext(Scope)

/** What the publisher of a filter takes. */
export interface PublishFilterProps {
    /** The store of the card the tabs belong to. */
    readonly store: FilterStore
    /** The filter as the card's header zone draws it. */
    readonly fields: FilterFields
}

/** Hands the filter to the card header after each render and takes it back when the tabs go; it draws nothing. */
export const PublishFilter = (props: PublishFilterProps): ReactNode => {
    useEffect(() => {
        props.store.set(props.fields)
    })
    useEffect(
        () => () => {
            props.store.set(null)
        },
        [props.store],
    )
    return null
}
