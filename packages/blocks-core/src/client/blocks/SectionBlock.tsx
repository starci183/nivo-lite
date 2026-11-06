import type { ReactNode } from "react"
import { Button, DropdownMenu, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { sectionBlock } from "../../blocks/section.block"
import { chosenSort, sortChoicesOf, sortTriggerText } from "../../rows/sort-choice"
import { useBlockWords } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

/** A titled card: an optional hint over the stacked child blocks, and an optional sort select at the end of its head. */
export const SectionBlock = (props: RenderOf<typeof sectionBlock>): ReactNode => {
    const words = useBlockWords()
    const hint = props.props.hint
    const sort = props.props.sort
    const choices = sort === undefined ? [] : sortChoicesOf(sort.options, words)
    const chosen = sort === undefined ? null : chosenSort(choices, props.params.value(sort.param))
    return (
        <SurfaceCard
            label={words(props.props.title)}
            headingLevel={2}
            {...(sort === undefined || chosen === null
                ? {}
                : {
                      labelEnd: (
                          <DropdownMenu
                              placement="bottom end"
                              trigger={<Button intent="neutral">{sortTriggerText(words(sort.label), chosen)}</Button>}
                              entries={[
                                  {
                                      kind: "section",
                                      id: "sort",
                                      label: words(sort.label),
                                      items: choices.map((choice) => ({ id: choice.value, label: choice.label })),
                                      selection: {
                                          mode: "single",
                                          selectedIds: [chosen.value],
                                          onChange: (ids) => props.params.set(sort.param, ids[0] ?? chosen.value),
                                      },
                                  },
                              ]}
                          />
                      ),
                  })}
        >
            <Stack gap="row">
                {hint === undefined ? null : (
                    <Text size="sm" tone="muted">
                        {words(hint)}
                    </Text>
                )}
                <Stack gap="row">{props.children}</Stack>
            </Stack>
        </SurfaceCard>
    )
}
