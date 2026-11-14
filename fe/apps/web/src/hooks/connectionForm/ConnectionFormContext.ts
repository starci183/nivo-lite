"use client"

import { createContext, useContext, type Context } from "react"
import type { ConnectionFormState } from "./useConnectionFormState"

/** The account's form state, shared by the page head (Kiem tra ket noi, Luu) and the "Ket noi" card. Absent outside the open page. */
export const ConnectionFormContext: Context<ConnectionFormState | null> = createContext<ConnectionFormState | null>(null)

/** The form state of the open account page; null where no page provides it. */
export const useConnectionForm = (): ConnectionFormState | null => useContext(ConnectionFormContext)
