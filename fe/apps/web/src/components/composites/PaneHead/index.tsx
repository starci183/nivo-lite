import { Button, PaneHeader, PaneSection } from "@starci/grammar/common"
import type { PaneHeaderProps } from "@starci/grammar/common"
import { WIDE_ONLY_CLASS_NAME } from "./classNames"

/** The one filled command of a pane: where it is drawn depends on the width. */
export interface PanePrimary {
    readonly label: string
    readonly onPress: () => void
    readonly isPending?: boolean
}

/** What a pane head band draws: the head, and the pane's one primary command when it has one. */
interface PaneHeadProps extends PaneHeaderProps {
    readonly primary?: PanePrimary
}

/**
 * The head band of a pane, the same everywhere: the pane head centred in its band. The primary command ends the row from the
 * medium breakpoint; a phone gets it as a full-width button under the head (the frame draws that one), so the title keeps its width.
 */
export const PaneHead = (props: PaneHeadProps) => {
    const { primary, actions, ...head } = props
    return (
        <PaneSection align="center">
            <PaneHeader
                {...head}
                {...(actions === undefined && primary === undefined
                    ? {}
                    : {
                          actions: (
                              <>
                                  {actions}
                                  {primary === undefined ? null : (
                                      <div className={WIDE_ONLY_CLASS_NAME}>
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
                              </>
                          ),
                      })}
            />
        </PaneSection>
    )
}
