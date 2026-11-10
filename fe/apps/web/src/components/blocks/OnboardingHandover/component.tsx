import { Button, EmptyNotice, Switch } from "@starci/grammar/common"
import { FirstRunCard } from "@/components/frames/FirstRunCard"

/** One rule the workspace starts with: its name, what it means and the value it holds; a rule with a `toggle` is changed in place. */
export interface OnboardingRuleView {
    readonly id: string
    readonly name: string
    readonly description: string
    readonly value: string
    readonly toggle?: {
        readonly isOn: boolean
        readonly isDisabled: boolean
    }
}

/** Copy the handover step supplies. */
export interface OnboardingHandoverBaseProps {
    readonly on: { readonly toggle: (ruleId: string, on: boolean) => void }
    readonly props: {
        readonly title: string
        readonly heading: string
        readonly description: string
        readonly rules: ReadonlyArray<OnboardingRuleView>
        readonly emptyRules: string
        readonly backLabel: string
        readonly backHref: string
        readonly finishLabel: string
        readonly finishHref: string
    }
}

/** Draws the handover step: how the AI works with the owner, the rules the workspace starts with, and the ways back and on. */
export const OnboardingHandoverBase = (props: OnboardingHandoverBaseProps) => {
    const view = props.props
    return (
        <FirstRunCard
            title={view.title}
            heading={view.heading}
            description={view.description}
            actions={
                <>
                    <Button intent="neutral" href={view.backHref}>
                        {view.backLabel}
                    </Button>
                    <Button endArrow intent="commit" href={view.finishHref}>
                        {view.finishLabel}
                    </Button>
                </>
            }
            collection={{
                kind: "list",
                empty: <EmptyNotice message={view.emptyRules} />,
                items: view.rules.map((rule) => ({
                    id: rule.id,
                    title: rule.name,
                    description: rule.description,
                    meta: { text: rule.value },
                    actionPlacement: "end" as const,
                    ...(rule.toggle === undefined
                        ? {}
                        : {
                              control: (
                                  <Switch
                                      name={rule.id}
                                      label={rule.name}
                                      isLabelHidden
                                      isSelected={rule.toggle.isOn}
                                      isDisabled={rule.toggle.isDisabled}
                                      onSelectedChange={(on) => props.on.toggle(rule.id, on)}
                                  />
                              ),
                          }),
                })),
            }}
        />
    )
}
