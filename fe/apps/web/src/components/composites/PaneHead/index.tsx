import type { ReactNode } from "react"
import { Button, IconButton, PaneHeader, PaneSection, type PaneHeaderProps } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { WIDE_ONLY_CLASS_NAME } from "./classNames"

/** The one filled command of a pane: where it is drawn depends on the width. */
export interface PanePrimary {
    readonly label: string
    readonly onPress: () => void
    readonly isPending?: boolean
    /** A glyph before the label, drawn only by the phone button (md); the sm button of the head band takes no icon. */
    readonly startContent?: ReactNode
}

/** The outlined command that stands before the primary one from the medium width and is absent on a phone. */
interface PaneSecondary {
    readonly label: string
    readonly onPress: () => void
}

/** What a pane head band draws: the head, and the pane's one primary command when it has one. */
interface PaneHeadProps extends PaneHeaderProps {
    readonly primary?: PanePrimary
    readonly secondary?: PaneSecondary
    /** Closes this pane (a side pane at the wide width, where it is a column with no drawer close): the last control of the row. */
    readonly close?: { readonly label: string; readonly onPress: () => void }
    /** Where a phone draws the primary command: under the head (default, drawn by `PaneBody`) or in the head row. */
    readonly primaryOnPhone?: "body" | "head"
}

/**
 * The head band of a pane, the same everywhere: the pane head centred in its band. The primary command ends the row from the
 * medium breakpoint; a phone gets it as a full-width button under the head (the frame draws that one), so the title keeps its width.
 */
export const PaneHead = (props: PaneHeadProps) => {
    const { primary, secondary, close, primaryOnPhone, actions, ...head } = props
    return (
        <PaneSection align="center">
            <PaneHeader
                {...head}
                {...(actions === undefined && primary === undefined && secondary === undefined && close === undefined
                    ? {}
                    : {
                          actions: (
                              <>
                                  {actions}
                                  {secondary === undefined ? null : (
                                      <div className={WIDE_ONLY_CLASS_NAME}>
                                          <Button
                                              intent="alternative"
                                              size="sm"
                                              onPress={secondary.onPress}
                                          >
                                              {secondary.label}
                                          </Button>
                                      </div>
                                  )}
                                  {primary === undefined ? null : (
                                      <div className={primaryOnPhone === "head" ? undefined : WIDE_ONLY_CLASS_NAME}>
                                          <Button
                                              intent="commit"
                                              size="sm"
                                              isPending={primary.isPending === true}
                                              onPress={primary.onPress}
                                          >
                                              {primary.label}
                                          </Button>
                                      </div>
                                  )}
                                  {close === undefined ? null : (
                                      <IconButton
                                          intent="dismiss"
                                          source={nivoIconSource("close", "leading")}
                                          label={close.label}
                                          onPress={close.onPress}
                                      />
                                  )}
                              </>
                          ),
                      })}
            />
        </PaneSection>
    )
}
