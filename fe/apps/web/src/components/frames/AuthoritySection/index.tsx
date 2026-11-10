import type { ReactNode } from "react"
import { Cluster, Stack, SurfaceCard } from "@starci/grammar/common"

/** The words and state every authority section shares. */
export interface AuthoritySectionView {
    readonly title: string
    readonly description: string
    readonly saveLabel: string
    readonly isPending: boolean
    /** Staff see the section but cannot change it: the controls do not take focus. */
    readonly isLocked: boolean
}

/** One card of a section: one group of fields. The label is left out when the pane head already names it. */
interface AuthorityCardView {
    readonly id: string
    readonly label?: string
    /** The caption under this card. */
    readonly note?: string
    readonly children: ReactNode
}

/** Props for AuthoritySection. */
type AuthoritySectionProps = {
    readonly section: AuthoritySectionView
    /** The connected section owns the save command and its pending or read state; it sits in the foot of the last card. */
    readonly footer: ReactNode
    readonly cards: ReadonlyArray<AuthorityCardView>
}

/** The caption under a card: its own note, and for the last card the line that says what the section holds. */
const captionOf = (card: AuthorityCardView, description: string | undefined): string | undefined => {
    const parts = [card.note, description].filter((part): part is string => part !== undefined && part !== "")
    return parts.length === 0 ? undefined : parts.join(" ")
}

/** An authority settings section: one card per group of fields, the section's line under the last card and one primary save in its foot. */
export const AuthoritySection = (props: AuthoritySectionProps) => (
    <div inert={props.section.isLocked}>
        <Stack gap="section">
            {props.cards.map((card, index) => {
                const isLast = index === props.cards.length - 1
                const note = captionOf(card, isLast ? props.section.description : undefined)
                return (
                    <SurfaceCard
                        key={card.id}
                        {...(card.label === undefined
                            ? { ariaLabel: props.section.title }
                            : { label: card.label, headingLevel: 3 as const })}
                        {...(note === undefined ? {} : { note })}
                        {...(isLast
                            ? {
                                  footers: [
                                      {
                                          kind: "custom" as const,
                                          children: (
                                              <Cluster gap="row" justify="end">
                                                  {props.footer}
                                              </Cluster>
                                          ),
                                      },
                                  ],
                              }
                            : {})}
                    >
                        {card.children}
                    </SurfaceCard>
                )
            })}
        </Stack>
    </div>
)
