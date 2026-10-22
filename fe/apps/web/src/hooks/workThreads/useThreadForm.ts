"use client"

import { useCallback, useState } from "react"

/** The new-thread form: whether it is open and the title typed; creating closes it and clears the title once the thread opened. */
export const useThreadForm = (open: (title: string) => Promise<boolean>) => {
    const [isOpen, setIsOpen] = useState(false)
    const [title, setTitle] = useState("")

    const show = useCallback(() => setIsOpen(true), [])
    const cancel = useCallback(() => setIsOpen(false), [])
    const create = useCallback(() => {
        void open(title.trim()).then((made) => {
            if (!made) return
            setIsOpen(false)
            setTitle("")
        })
    }, [open, title])

    return { isOpen, title, setTitle, show, cancel, create }
}
