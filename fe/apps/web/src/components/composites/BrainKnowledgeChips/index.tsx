import type { PageHeaderContent } from "@starci/grammar/common"
import type { BrainChipsView } from "@/modules/types"

/**
 * The second tab row of the knowledge tab: the documents, the facts and the lessons, each with its count. It lives in the
 * header band under the page tabs (never on the well), and every item is a link to its page, so the address keeps the chip and a refresh
 * or a shared link opens the same one. Nothing but the knowledge tab has the row: the other tabs return an empty object to spread.
 */
export const brainHeaderSubTabs = (chips: BrainChipsView | null): { readonly subTabs?: NonNullable<PageHeaderContent["subTabs"]> } =>
    chips === null
        ? {}
        : {
              subTabs: {
                  label: chips.label,
                  selectedKey: chips.selectedKey,
                  labelVisibility: "always",
                  items: chips.items.map((chip) => ({
                      id: chip.id,
                      label: chip.label,
                      href: chip.href,
                      ...(chip.count === undefined ? {} : { count: chip.count }),
                      ...(chip.isAttention === true ? { isAttention: true } : {}),
                  })),
              },
          }
