import { useState, useTransition } from "react"
import { navigation } from "@/modules/i18n"

/** The state every row action of a workbench shares: which row is busy, the error of each row and the refresh after a success. */
export const useBusyRow = () => {
    const router = navigation.useRouter()
    const [isPending, startTransition] = useTransition()
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [errors, setErrors] = useState<Readonly<Record<string, string>>>({})
    return { router, isPending, startTransition, busyKey, setBusyKey, errors, setErrors }
}
