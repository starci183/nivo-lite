"use client"

import { createContext, useContext, type Context } from "react"
import type { PageFrameTabs } from "@nivo-lite/agent-sdk/client"

/** Takes the view tabs of a workbench, which the frame draws as the second tab layer of its header; null when the workbench goes. */
type WorkbenchTabsSink = (tabs: PageFrameTabs | null) => void

/** The context the agent frame provides its sink on; the frame provides it, a workbench reads it through `useWorkbenchTabsSink`. */
export const WorkbenchTabsContext: Context<WorkbenchTabsSink | null> = createContext<WorkbenchTabsSink | null>(null)

/** The sink of the agent frame around this workbench; null outside one (the workbench then draws its own tabs). */
export const useWorkbenchTabsSink = (): WorkbenchTabsSink | null => useContext(WorkbenchTabsContext)
