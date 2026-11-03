"use client"

import { useCallback, useState } from "react"
import type { ComposerOption } from "@/modules/types"
import { pickedOf } from "@/modules/work-threads"
import type { PickedMention } from "@/modules/work-threads"
import type { SetStateAction, Dispatch } from "react"

type UseThreadComposerResult = {
    draft: string
    setDraft: Dispatch<SetStateAction<string>>
    pickMention: (option: ComposerOption) => void
    submit: () => void
}

/** The draft of the message being written and the tags picked from the at-sign list; sending clears both once the message went. */
export const useThreadComposer = (
    send: (draft: string, picked: ReadonlyArray<PickedMention>) => Promise<boolean>,
): UseThreadComposerResult => {
    const [draft, setDraft] = useState("")
    const [picked, setPicked] = useState<ReadonlyArray<PickedMention>>([])

    const pickMention = useCallback((option: ComposerOption): void => {
        const tag = pickedOf(option)
        if (tag !== null) setPicked((was) => [...was, tag])
    }, [])

    const submit = useCallback((): void => {
        void send(draft, picked).then((sent) => {
            if (!sent) return
            setDraft("")
            setPicked([])
        })
    }, [draft, picked, send])

    return { draft, setDraft, pickMention, submit }
}
