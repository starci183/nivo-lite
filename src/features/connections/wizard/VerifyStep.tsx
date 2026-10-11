"use client"

import { useEffect, useRef, useState } from "react"
import { Alert, LeadingNumber, List, ListItem, Spinner, Text } from "@starci/grammar/common"
import { useLocale, useT } from "@/i18n/client"
import { connectionWizard } from "@/i18n/dict/connectionWizard"
import { checkFirstEvent, type FirstEventState } from "@/lib/connection-actions"
import { fill, type GuideContext, type VerifyHelp } from "@/lib/connection-providers"
import { COPY_CLASS, NUMBERED_CLASS } from "./classNames"

/** Props for {@link VerifyStep}. */
export type VerifyStepProps = {
  readonly connectionId: string
  readonly help: VerifyHelp | undefined
  readonly ctx: GuideContext
  readonly onReceived: (state: FirstEventState) => void
  readonly initial: FirstEventState["firstEvent"]
}

const POLL_MS = 3000
const money = (n: number) => `${n.toLocaleString("vi-VN")} đ`

/** Waits for the first webhook of this connection (asks every 3 seconds) and says plainly what the owner should do meanwhile. */
export const VerifyStep = ({ connectionId, help, ctx, onReceived, initial }: VerifyStepProps) => {
  const t = useT(connectionWizard)
  const locale = useLocale()
  const [event, setEvent] = useState(initial)
  const [failed, setFailed] = useState(false)
  const notify = useRef(onReceived)
  notify.current = onReceived

  useEffect(() => {
    if (event) return
    let stop = false
    const tick = async () => {
      const r = await checkFirstEvent(connectionId).catch(() => null)
      if (stop) return
      if (r && r.ok && r.data.firstEvent) {
        setEvent(r.data.firstEvent)
        notify.current(r.data)
      } else setFailed(!r || !r.ok)
    }
    const timer = setInterval(tick, POLL_MS)
    void tick()
    return () => { stop = true; clearInterval(timer) }
  }, [connectionId, event])

  return (
    <>
      {help ? (
        <div className={COPY_CLASS}>
          <Text size="sm">{help.intro[locale]}</Text>
          <List as="ol" className={NUMBERED_CLASS}>{help.steps.map((s, i) => <ListItem key={s.vi}><Text size="sm" startContent={<LeadingNumber position={i + 1} />}>{fill(s[locale], ctx)}</Text></ListItem>)}</List>
        </div>
      ) : null}
      {event ? (
        <Alert tone="affirmative" title={event.content ? t("verifyReceived", { amount: money(event.amount), content: event.content }) : t("verifyReceivedNoContent", { amount: money(event.amount) })} />
      ) : (
        <Text size="sm" weight="medium" startContent={<Spinner size="sm" label={t("verifyWaiting")} />}>{t("verifyWaiting")}</Text>
      )}
      {failed && !event ? <Text size="xs" tone="muted">{t("verifyError")}</Text> : null}
    </>
  )
}
