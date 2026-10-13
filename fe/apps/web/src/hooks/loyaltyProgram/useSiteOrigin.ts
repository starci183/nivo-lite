"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => undefined
const browserOrigin = () => window.location.origin
const serverOrigin = () => ""

/** The origin of the page ("https://host"); empty while the server renders. */
export const useSiteOrigin = (): string => useSyncExternalStore(subscribe, browserOrigin, serverOrigin)
