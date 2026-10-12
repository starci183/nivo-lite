"use client"

import { Heading } from "@starci/grammar/common"

import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { createElement, useEffect, useId, useState, type ComponentType, type CSSProperties } from "react"

import { RAIL_CLASS_NAME, RAIL_CONTROL_CLASS_NAME } from "./classNames"

/** Props for a persisted, accessible navigation rail. */
export type CollapsibleRailProps<RailProps extends object, CompactProps extends object, ToggleProps extends object> = {
    readonly ariaLabel: string
    /** Whether this standalone rail owns a complementary landmark. */
    readonly landmark?: "complementary" | "none"
    readonly title?: string
    readonly rail: ComponentType<RailProps>
    readonly railProps: RailProps
    readonly collapsedRail: ComponentType<CompactProps>
    readonly collapsedRailProps: CompactProps
    readonly toggleControl: ComponentType<ToggleProps>
    readonly toggleControlProps: ToggleProps
    readonly collapseLabel: string
    readonly expandLabel: string
    readonly storageKey?: string
    readonly isDefaultCollapsed?: boolean
    readonly onCollapsedChange?: (collapsed: boolean) => void
}

const DEFAULT_STORAGE_KEY = "nivo:console-rail-collapsed"
const readPersistedState = (key: string): boolean | undefined => {
    try {
        const value = globalThis.localStorage?.getItem(key)
        return value === "true" ? true : value === "false" ? false : undefined
    } catch {
        return undefined
    }
}

/** Render a responsive navigation rail with persisted collapse state. */
export const CollapsibleRail = <R extends object, C extends object, T extends object>(props: CollapsibleRailProps<R, C, T>) => {
    const reduceMotion = useReducedMotion()
    const headingId = useId()
    const [collapsed, setCollapsed] = useState(props.isDefaultCollapsed ?? false)
    useEffect(() => {
        const persisted = readPersistedState(props.storageKey ?? DEFAULT_STORAGE_KEY)
        if (persisted !== undefined) setCollapsed(persisted)
    }, [props.storageKey])
    const toggle = () => {
        setCollapsed((value) => {
            const next = !value
            try { globalThis.localStorage?.setItem(props.storageKey ?? DEFAULT_STORAGE_KEY, String(next)) } catch { /* storage is optional */ }
            props.onCollapsedChange?.(next)
            return next
        })
    }
    const label = collapsed ? props.expandLabel : props.collapseLabel
    const railStyle: CSSProperties = {
        flexDirection: "column",
        minHeight: "100%",
        overflow: "hidden",
        borderInlineEnd: "1px solid var(--separator)",
        gap: "1.5rem",
        padding: collapsed ? "1.5rem 0.625rem" : "1.5rem",
    }
    const rail = collapsed
        ? createElement(props.collapsedRail, props.collapsedRailProps)
        : createElement(props.rail, props.railProps)
    const toggleControl = createElement(props.toggleControl, props.toggleControlProps)
    const Root = props.landmark === "none" ? motion.div : motion.aside
    return (
        <Root
            className={RAIL_CLASS_NAME}
            aria-labelledby={props.landmark === "none" ? undefined : headingId}
            aria-label={props.landmark === "none" ? undefined : props.ariaLabel}
            animate={{ width: collapsed ? 64 : 256 }}
            initial={false}
            transition={{ duration: reduceMotion === true ? 0 : 0.18, ease: "easeOut" }}
            style={railStyle}
        >
            <div id={headingId}><Heading level={2} isVisuallyHidden>{props.ariaLabel}</Heading></div>
            <div>
                <AnimatePresence initial={false}>
                    {!collapsed && props.title === undefined ? null : <span>{collapsed ? null : props.title}</span>}
                </AnimatePresence>
                <button className={RAIL_CONTROL_CLASS_NAME} type="button" aria-label={label} aria-expanded={!collapsed} onClick={toggle}>
                    {toggleControl}
                </button>
            </div>
            <div>{rail}</div>
        </Root>
    )
}
