import { OfficeApprovalCard } from "@/components/branches/OfficeApprovalCard"
import { OfficeAvatar } from "@/components/branches/OfficeAvatar"
import { OfficeCommandCard } from "@/components/branches/OfficeCommandCard"
import { OfficeExceptionCard } from "@/components/branches/OfficeExceptionCard"
import { OfficeExceptionForm } from "@/components/branches/OfficeExceptionForm"
import type { OfficeThreadProps, OfficeExceptionView, OfficeCommandView, OfficeApprovalView } from "@/modules/types"

/** Renders the OfficeThread exception section. */
export const renderOfficeThreadException = (
    item: OfficeExceptionView,
    text: NonNullable<OfficeThreadProps["props"]["text"]>,
    view: OfficeThreadProps["props"],
    props: OfficeThreadProps,
) => (
    <OfficeExceptionCard
        key={item.key}
        item={item}
        avatar={<OfficeAvatar avatar={item.avatar} size="sm" />}
        text={text}
        form={
            <OfficeExceptionForm
                item={item}
                text={text}
                isBusy={view.busyId === item.id}
                onDecide={props.on.decideWork}
            />
        }
    />
)

/** Renders the OfficeThread command section. */
export const renderOfficeThreadCommand = (
    item: OfficeCommandView,
    text: NonNullable<OfficeThreadProps["props"]["text"]>,
    view: OfficeThreadProps["props"],
    props: OfficeThreadProps,
) => (
    <OfficeCommandCard
        key={item.key}
        command={item}
        ask={item.ask}
        agent={item.agent}
        avatar={<OfficeAvatar avatar={item.avatar} size="sm" />}
        text={text}
        isBusy={view.busyId === item.id}
        onSend={props.on.sendCommand}
        onCancel={props.on.cancelCommand}
    />
)

/** Renders the OfficeThread reading section. */
export const renderOfficeThreadReading = (
    reading: NonNullable<OfficeThreadProps["props"]["reading"]>,
    text: NonNullable<OfficeThreadProps["props"]["text"]>,
    props: OfficeThreadProps,
) => (
    <OfficeCommandCard
        command={null}
        ask={reading.ask}
        agent={reading.agent}
        avatar={<OfficeAvatar avatar={reading.avatar} size="sm" />}
        text={text}
        isBusy={false}
        onSend={props.on.sendCommand}
        onCancel={props.on.cancelCommand}
    />
)

/** Renders the OfficeThread approval section. */
export const renderOfficeThreadApproval = (
    item: OfficeApprovalView,
    text: NonNullable<OfficeThreadProps["props"]["text"]>,
    view: OfficeThreadProps["props"],
    props: OfficeThreadProps,
) => (
    <OfficeApprovalCard
        key={item.key}
        approval={item}
        avatar={<OfficeAvatar avatar={item.avatar} size="sm" />}
        text={text}
        isBusy={view.busyId === item.id}
        onDecide={props.on.decideApproval}
    />
)
