import type { ContactMessagesQuery } from "@/modules/api"
import type {
    ContactHistoryLineView,
    ContactHistoryTabView,
    ContactHistoryVoice,
    ContactHistoryWords,
} from "@/modules/types"
import { brandOf, type ContactDetailWire } from "./contacts.view"

/** One line of the conversation as the back end answers it. */
export type ContactLineWire = ContactMessagesQuery["contactMessages"]["rows"][number]

/** One route of the open person (this person on one channel account), as the `contact` read serves it. */
export type ContactRouteWire = ContactDetailWire["routes"][number]

/** The tab that holds every channel. */
export const HISTORY_ALL_KEY = "all"

/**
 * The tabs of the conversation block: every channel, then one per route of the person, keyed by the route id (the API narrows a read
 * to one route, so a channel the person is on through two accounts gets one tab per account, named "Zalo · <account>"). A channel
 * on one route is named by its brand alone. Routes come most recently spoken on first and the tabs keep that order.
 */
export const historyTabsOf = (
    routes: ReadonlyArray<ContactRouteWire>,
    allLabel: string,
): ReadonlyArray<ContactHistoryTabView> => {
    const brandOfRoute = (route: ContactRouteWire): string => brandOf(route.channel) ?? route.channel
    const count = (brand: string): number => routes.filter((route) => brandOfRoute(route) === brand).length
    return [
        { key: HISTORY_ALL_KEY, label: allLabel },
        ...routes.map((route) => {
            const brand = brandOfRoute(route)
            const account = route.accountName?.trim() ?? ""
            return { key: route.routeId, label: count(brand) > 1 && account !== "" ? `${brand} · ${account}` : brand }
        }),
    ]
}

/** The route a tab narrows the read to: none for the "all" tab (every route), else the route the tab is keyed by (null when the key names no route of the person). */
export const routeOfTab = (routes: ReadonlyArray<ContactRouteWire>, tabKey: string): ContactRouteWire | null =>
    routes.find((route) => route.routeId === tabKey) ?? null

/** Who said a line: the person, a member of the shop who typed it, or an agent (the speaker the server names). */
const voiceOf = (line: ContactLineWire): ContactHistoryVoice =>
    line.speaker.kind === "agent" || line.speaker.kind === "staff" ? line.speaker.kind : "person"

/** The author caption of a line by its voice: the server's speaker name, a plain word when it names none. */
const authorOf = (line: ContactLineWire, voice: ContactHistoryVoice, words: ContactHistoryWords): string => {
    if (voice === "person") return words.person
    return voice === "staff" ? words.staff(line.speaker.name) : words.agent(line.speaker.name)
}

/** The calendar day of an instant in the viewer's zone, as a sortable key. */
const dayKeyOf = (iso: string): string => {
    const at = new Date(iso)
    return `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`
}

/**
 * The lines of every page read so far as one thread, oldest first. The server answers each page newest first and the pages from the
 * newest to the older, so the thread is that order reversed (the server's own tie-break is kept); a line that two pages both hold is
 * kept once. A separator names the day, with the channel when the tab holds every channel.
 */
export const historyLinesOf = (
    rows: ReadonlyArray<ContactLineWire>,
    words: ContactHistoryWords,
    isEveryChannel: boolean,
): ReadonlyArray<ContactHistoryLineView> => {
    const unique = [...new Map(rows.map((row) => [row.id, row])).values()].reverse()
    let previous = ""
    return unique.map((line) => {
        const channel = isEveryChannel ? (brandOf(line.channel) ?? line.channel) : null
        const group = `${dayKeyOf(line.saidAt)}|${channel ?? ""}`
        const separator = group === previous ? null : words.day(line.saidAt, channel)
        previous = group
        const voice = voiceOf(line)
        const order = voice === "person" ? null : words.order(line.orderJson)
        return {
            id: line.id,
            voice,
            author: authorOf(line, voice, words),
            time: words.time(line.saidAt),
            text: line.text,
            // A file the server could not keep (`url` null, `notKept` set) has nothing to open: it is left out until the history shows
            // its "could not be fetched" state (fe owner, E-FIX9's need).
            files: line.files.flatMap((file, index) =>
                file.url === null
                    ? []
                    : [
                          {
                              id: `${line.id}:${index}`,
                              name: file.name === null || file.name === "" ? (file.caption ?? file.url) : file.name,
                              contentType: file.contentType,
                              url: file.url,
                          },
                      ],
            ),
            order,
            separator,
        }
    })
}
