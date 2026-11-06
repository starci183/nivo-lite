import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import type { ActionHandle, ReadHandle } from "@nivo-lite/agent-sdk/block"
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import type { salesAttentionCardBlock } from "../../blocks/sales/attention-card.block"
import { countedWords } from "../../rows/counted-words"
import { recordsView } from "../../rows/rows"
import { cellContextOf, formatValue } from "../../rows/cell-format"
import {
    ATTENTION_COUNT_KEY,
    ATTENTION_KINDS,
    ATTENTION_KIND_VIEWS,
    attentionEntriesOf,
    attentionListOf,
    parkedEntriesOf,
} from "../../rules/sales/attention-list"
import type { AttentionCommand, AttentionEntry } from "../../rules/sales/attention-list"
import { combinedSlots } from "../../slots/combine"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

type Props = RenderOf<typeof salesAttentionCardBlock>

/** The rows the card shows while the first read loads: the geometry of settled ones. */
const PLACEHOLDER: ReadonlyArray<AttentionEntry> = [0, 1, 2].map((index) => ({
    id: `placeholder-${index}`,
    kind: "waiting",
    title: "........",
    description: "........",
    at: "",
}))

/** The entries one read gives, as a slot of its own so a read that failed does not hide the others. */
const entriesSlot = (handle: ReadHandle, entriesOf: typeof attentionEntriesOf) =>
    derivedSlot(parsedSlot(handle.slot, recordsView), (records) => {
        const entries = entriesOf(records)
        return entries.length === 0 ? null : entries
    })

/** Reads again every read the card is made of. */
const retryReads = (props: Props): void => {
    props.slots.attention.retry()
    props.slots.awaitingReply.retry()
    props.slots.parkedRuns.retry()
}

/** The name and the line of a row: the words of a step or failure the list knows, else the raw ones the read gave. */
const wordsOf = (
    item: AttentionEntry,
    word: (key: string) => string,
): { readonly title: string; readonly description: string } => ({
    title: item.titleKey === undefined ? item.title : word(item.titleKey),
    description: item.descriptionKey === undefined ? item.description : word(item.descriptionKey),
})

/**
 * What needs the owner on the Sales "needs attention" view: customers waiting for a reply, deals past their next step, questions the
 * assistant has for the owner, orders over the limit and steps that failed, each with a chip that says why and one command.
 */
export const AttentionCardBlock = (props: Props): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const word = (key: string): string => words({ key })
    const context = cellContextOf(host.locale(), undefined)
    const labels = useSlotLabels(props.props.empty)
    const shown = props.props.kinds ?? ATTENTION_KINDS
    const slot = combinedSlots([
        entriesSlot(props.slots.attention, attentionEntriesOf),
        entriesSlot(props.slots.awaitingReply, attentionEntriesOf),
        entriesSlot(props.slots.parkedRuns, parkedEntriesOf),
    ])
    const listed = derivedSlot(slot, (items) => {
        const list = attentionListOf(items, shown)
        return list.length === 0 ? null : list
    })
    const display: DataSlot<ReadonlyArray<AttentionEntry>> = "isEmpty" in listed ? { items: [] } : listed
    const run = (handle: ActionHandle, id: string): void => {
        handle
            .run({ id })
            .then((outcome) => {
                if (!outcome.ok) host.notify("danger", labels.error)
            })
            .catch(() => host.notify("danger", labels.error))
    }
    const commands: Readonly<Record<AttentionCommand, ActionHandle>> = {
        respond: props.slots.respond,
        follow: props.slots.follow,
        reply: props.slots.reply,
        review: props.slots.review,
        resume: props.slots.resume,
    }
    const selectParam = props.props.selectParam
    const rowOf = (item: AttentionEntry): ListRowData => {
        const view = ATTENTION_KIND_VIEWS[item.kind]
        const handle = commands[view.command]
        const { title, description } = wordsOf(item, word)
        return {
            id: `${item.kind}:${item.id}`,
            title,
            ...(description === "" ? {} : { description }),
            leading: { avatar: { name: title } },
            badges: [{ label: word(view.chipKey), tone: view.tone }],
            ...(item.at === "" ? {} : { meta: { text: formatValue(item.at, "day", context) } }),
            ...(handle.isAllowed
                ? { action: { label: word(view.commandKey), press: () => run(handle, item.id) } }
                : {}),
            ...(selectParam !== undefined && view.opensLead
                ? { onPress: () => props.params.set(selectParam, item.id) }
                : {}),
        }
    }
    const count = "items" in display ? display.items.length : null
    return (
        <SlotView
            slot={display}
            labels={labels}
            placeholder={PLACEHOLDER}
            onRetry={() => retryReads(props)}
            frame={(notice) => (
                <SurfaceCard label={words(props.props.label)} headingLevel={3}>
                    {notice}
                </SurfaceCard>
            )}
            render={(items, isLoading) => (
                <SurfaceCard
                    kind="list"
                    label={words(props.props.label)}
                    headingLevel={3}
                    {...(count === null ? {} : { fact: countedWords(word(ATTENTION_COUNT_KEY), count) })}
                    isLoading={isLoading}
                    items={items.map(rowOf)}
                    empty={<EmptyNotice message={labels.empty} />}
                />
            )}
        />
    )
}
