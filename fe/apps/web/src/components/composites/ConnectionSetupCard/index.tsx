import { Button, Cluster, Stack, Stepper, SurfaceCard, Text } from "@starci/grammar/common"

/** The one step left of the setup: what it is, what it stops, and the command that continues it. */
interface ConnectionSetupNext {
    readonly title: string
    readonly body: string
    readonly action?: { readonly label: string; readonly href: string }
}

/** What the setup card of a connection page draws. */
interface ConnectionSetupCardProps {
    /** "Setup · step 3/4", already in the reader's language. */
    readonly title: string
    /** The four phases' names: details, grant, check, hand to an agent. */
    readonly phases: ReadonlyArray<string>
    /** The phase being worked on, 1-based; past the last one the setup is done. */
    readonly current: number
    /** The current phase stopped on a failure: its mark is the problem mark. */
    readonly isProblem?: boolean
    /** The accessible words of a phase's state. */
    readonly stateLabels: { readonly complete: string; readonly current: string; readonly upcoming: string }
    readonly next?: ConnectionSetupNext
    readonly isLoading?: boolean
}

/**
 * The setup of a connection as the four phases every provider shares (details, grant, check, hand to an agent) on one horizontal
 * Stepper, done phases checked, and under it the one step left with the command that continues it.
 */
export const ConnectionSetupCard = (props: ConnectionSetupCardProps) => {
    const next = props.next
    return (
        <SurfaceCard
            label={props.title}
            isLoading={props.isLoading === true}
            {...(next === undefined
                ? {}
                : {
                      footers: [
                          {
                              kind: "custom" as const,
                              children: (
                                  <Cluster gap="inline" justify="between" wrap>
                                      <Stack gap="identity">
                                          <Text size="sm">{next.title}</Text>
                                          <Text size="xs" tone="muted">
                                              {next.body}
                                          </Text>
                                      </Stack>
                                      {next.action === undefined ? null : (
                                          <Button endArrow intent="commit" href={next.action.href}>
                                              {next.action.label}
                                          </Button>
                                      )}
                                  </Cluster>
                              ),
                          },
                      ],
                  })}
        >
            <Stepper
                label={props.title}
                currentStepId={`p${props.current}`}
                completeMarker="check"
                isLoading={props.isLoading === true}
                stateLabel={(state) =>
                    state === "complete" || state === "current" || state === "upcoming"
                        ? props.stateLabels[state]
                        : undefined
                }
                steps={props.phases.map((label, index) => ({
                    id: `p${index + 1}`,
                    label,
                    ...(index + 1 < props.current ? { state: "complete" as const } : {}),
                    ...(index + 1 === props.current && props.isProblem === true ? { state: "error" as const } : {}),
                }))}
            />
        </SurfaceCard>
    )
}
