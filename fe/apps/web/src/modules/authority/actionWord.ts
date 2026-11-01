/** A translator of the `governance` catalog, as far as the action words need it. */
interface ActionWords {
    (key: string): string
    has: (key: string) => boolean
}

/**
 * The words of an authority action, the one door every screen reads an action key through. The key may arrive bare
 * (`send_follow_up`) or in front of its module (`sales.send_follow_up`, as a command is named); an action the catalog has no
 * words for says the general phrase, never the key.
 */
export const actionWordOf = (g: ActionWords, action: string): string => {
    const key = action.slice(action.lastIndexOf(".") + 1)
    return g.has(`action_${key}`) ? g(`action_${key}`) : g("action_unknown")
}
