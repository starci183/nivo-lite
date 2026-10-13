import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { isListedBank } from "./banks.shared"

/** Names a bank code from the `banks` catalog (the code itself when NIVO does not list the bank). */
export const useBankName = (): ((code: string) => string) => {
    const banks = useTranslations("banks")
    return useCallback((code: string) => (isListedBank(code) ? banks(code) : code), [banks])
}
