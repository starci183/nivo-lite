import { useCallback, useState, useTransition } from "react"
import type { AutomationCardView, AutomationRunView, ShopContext } from "@/lib/automation-shared"
import type { DbFailure, DbOutcome, GoogleAccount } from "@/modules/db"
import { navigation } from "@/modules/i18n"

/** What the screen shows, as the page hands it over. */
export interface AutomationsData {
    readonly cards: ReadonlyArray<AutomationCardView>
    readonly runs: ReadonlyArray<AutomationRunView>
    readonly shop: ShopContext
    readonly accounts: ReadonlyArray<GoogleAccount>
}

/** An action on one card that answers the card as it stands afterwards. */
export type CardAction = () => Promise<DbOutcome<AutomationCardView>>

/** The local copy of the cards and the one action at a time that changes them. */
interface Automations {
    readonly cards: ReadonlyArray<AutomationCardView>
    readonly busyKey: string | null
    /** Why the last action was refused; the screen words it. */
    readonly failure: DbFailure | null
    readonly setFailure: (failure: DbFailure | null) => void
    /** Runs an action on a card; true when it worked and the card was replaced by its new self. */
    readonly apply: (key: string, action: CardAction) => Promise<boolean>
}

/** The screen's local copy of the cards: every action returns the changed card, which replaces its old self. */
export const useAutomations = (initial: ReadonlyArray<AutomationCardView>): Automations => {
    const router = navigation.useRouter()
    const [cards, setCards] = useState<ReadonlyArray<AutomationCardView>>(initial)
    const [busyKey, setBusyKey] = useState<string | null>(null)
    const [failure, setFailure] = useState<DbFailure | null>(null)
    const [, startTransition] = useTransition()

    const apply = useCallback(
        async (key: string, action: CardAction): Promise<boolean> => {
            setBusyKey(key)
            setFailure(null)
            const outcome = await action()
            setBusyKey(null)
            if (outcome.kind !== "ok") {
                setFailure(outcome)
                return false
            }
            setCards((previous) => previous.map((card) => (card.key === key ? outcome.value : card)))
            startTransition(() => router.refresh())
            return true
        },
        [router],
    )

    return { cards, busyKey, failure, setFailure, apply }
}
