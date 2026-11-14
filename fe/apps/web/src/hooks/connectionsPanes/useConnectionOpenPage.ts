"use client"

import { useParams } from "next/navigation"
import { useConnectionOpen, type ConnectionOpenRead } from "./useConnectionOpen"

/**
 * The connection the open page's address names (`/connections/open/<id>`), for its band and its tab body. Each reads it on its own;
 * the reads are one request, and the band's commands and questions keep their state in the band.
 */
export const useConnectionOpenPage = (): ConnectionOpenRead => {
    const params = useParams<{ id?: string }>()
    return useConnectionOpen(typeof params.id === "string" ? params.id : "")
}
