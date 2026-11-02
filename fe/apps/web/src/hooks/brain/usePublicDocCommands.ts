"use client"

import { usePublicDocDeciders } from "./usePublicDocDeciders"
import { usePublicDocRunner } from "./usePublicDocRunner"
import { usePublicDocStarters } from "./usePublicDocStarters"

/** The commands on the documents written for customers; each failure is toasted by the back end's words, and the lists they change are read again. */
export const usePublicDocCommands = () => {
    const { isPending, run } = usePublicDocRunner()
    return { isPending, ...usePublicDocStarters(run), ...usePublicDocDeciders(run) }
}
