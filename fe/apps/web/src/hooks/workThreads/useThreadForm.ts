"use client"

import { useCallback, useState } from "react"
import type { SetStateAction, Dispatch } from "react"

type UseThreadFormResult = {
    isOpen: boolean
    title: string
    setTitle: Dispatch<SetStateAction<string>>
    show: () => void
    cancel: () => void
    create: () => void
}

/** The new-thread form: whether it is open and the title typed; creating closes it and clears the title once the thread opened. */
export const useThreadForm = (open: (title: string) => Promise<boolean>): UseThreadFormResult => {
    const [isOpen, setIsOpen] = useState(false)
    const [title, setTitle] = useState("")

    const show = useCallback((): void => setIsOpen(true), [])
    const cancel = useCallback((): void => setIsOpen(false), [])
    const create = useCallback((): void => {
        void open(title.trim()).then((made) => {
            if (!made) return
            setIsOpen(false)
            setTitle("")
        })
    }, [open, title])

    return { isOpen, title, setTitle, show, cancel, create }
}
