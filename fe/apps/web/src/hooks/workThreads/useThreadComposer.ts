"use client"

import { useCallback, useState } from "react"
import type { ComposerOption } from "@/modules/types"
import { pickedOf } from "@/modules/work-threads"
import type { PickedMention } from "@/modules/work-threads"

/** The draft of the message being written and the tags picked from the at-sign list; sending clears both once the message went. */
export const useThreadComposer = (send: (draft: string, picked: ReadonlyArray<PickedMention>) => Promise<boolean>) => {
    const [draft, setDraft] = useState("")
    const [picked, setPicked] = useState<ReadonlyArray<PickedMention>>([])

    const pickMention = useCallback((option: ComposerOption) => {
        const tag = pickedOf(option)
        if (tag !== null) setPicked((was) => [...was, tag])
    }, [])

    const submit = useCallback(() => {
        void send(draft, picked).then((sent) => {
            if (!sent) return
            setDraft("")
            setPicked([])
        })
    }, [draft, picked, send])

    return { draft, setDraft, pickMention, submit }
}
