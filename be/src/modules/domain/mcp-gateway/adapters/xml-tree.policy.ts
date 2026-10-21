/** One XML element: its local name (namespace prefix dropped), its child elements and its own text. */
export interface XmlNode {
    /** The local name. */
    readonly name: string
    /** The child elements in order. */
    readonly children: Array<XmlNode>
    /** The decoded text directly inside it, trimmed. */
    text: string
}

/** An open element and the one around it while parsing. */
interface Frame {
    /** The open element. */
    readonly node: XmlNode
    /** The element around it; null for the document. */
    readonly parent: Frame | null
}

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }

/** Decodes the five named entities and numeric character references; an unknown entity is kept as written. */
export const decodeEntities = (value: string): string =>
    value.replaceAll(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (whole, body: string) => {
        if (body.startsWith("#x") || body.startsWith("#X"))
            return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
        if (body.startsWith("#")) return String.fromCodePoint(Number(body.slice(1)))
        return ENTITIES[body] ?? whole
    })

/** The name a tag opens with: what comes before its first whitespace, `/` or `>`, found by one single-class scan. */
const localName = (tag: string): string => {
    const stop = tag.search(/[\s/>]/u)
    const name = stop < 0 ? tag : tag.slice(0, stop)
    const colon = name.indexOf(":")
    return colon < 0 ? name : name.slice(colon + 1)
}

const SKIPPED: ReadonlyArray<readonly [string, string]> = [
    ["<?", "?>"],
    ["<!--", "-->"],
    ["<!", ">"],
]

/** Where a markup construct that is not an element ends; -1 when `at` opens an element tag, 0 when it never ends. */
const skipEnd = (xml: string, at: number): number => {
    const pair = SKIPPED.find(([start]) => xml.startsWith(start, at))
    if (pair === undefined) return -1
    const end = xml.indexOf(pair[1], at)
    return end < 0 ? 0 : end + pair[1].length
}

/** Where the parse stands after one construct. */
interface Scan {
    /** The open element. */
    readonly frame: Frame
    /** The next unread position. */
    readonly cursor: number
}

/** Keeps the CDATA section that opens at `open` as text of the open element; null when it never ends. */
const readCdata = (xml: string, open: number, frame: Frame): Scan | null => {
    const end = xml.indexOf("]]>", open)
    if (end < 0) return null
    frame.node.text += xml.slice(open + 9, end)
    return { frame, cursor: end + 3 }
}

/** Opens, closes or adds the element whose tag starts at `open`; null for an unclosed tag or a close that matches nothing. */
const readTag = (xml: string, open: number, frame: Frame): Scan | null => {
    const close = xml.indexOf(">", open)
    if (close < 0) return null
    const tag = xml.slice(open + 1, close)
    const cursor = close + 1
    if (tag.startsWith("/")) {
        if (frame.parent === null || frame.node.name !== localName(tag.slice(1))) return null
        frame.node.text = frame.node.text.trim()
        return { frame: frame.parent, cursor }
    }
    const node: XmlNode = { name: localName(tag), children: [], text: "" }
    frame.node.children.push(node)
    return { frame: tag.endsWith("/") ? frame : { node, parent: frame }, cursor }
}

/** Reads the markup construct that starts at `open`; null when it is not well formed. */
const readMarkup = (xml: string, open: number, frame: Frame): Scan | null => {
    if (xml.startsWith("<![CDATA[", open)) return readCdata(xml, open, frame)
    const skipped = skipEnd(xml, open)
    if (skipped > 0) return { frame, cursor: skipped }
    if (skipped === 0) return null
    return readTag(xml, open, frame)
}

/**
 * Reads an XML document into a tree, deterministically and without a dependency: declarations, comments and doctype are
 * skipped, CDATA is kept as text, attributes are ignored. Answers null when the markup is not well formed.
 */
export const parseXml = (xml: string): XmlNode | null => {
    const root: XmlNode = { name: "#document", children: [], text: "" }
    let scan: Scan | null = { frame: { node: root, parent: null }, cursor: 0 }
    while (scan !== null && scan.cursor < xml.length) {
        const open = xml.indexOf("<", scan.cursor)
        const textEnd = open < 0 ? xml.length : open
        scan.frame.node.text += decodeEntities(xml.slice(scan.cursor, textEnd))
        scan = open < 0 ? { frame: scan.frame, cursor: textEnd } : readMarkup(xml, open, scan.frame)
    }
    if (scan === null || scan.frame.parent !== null) return null
    return root.children.find((_, index, all) => all.length === 1 && index === 0) ?? null
}

/** The first descendant (depth first, the node itself included) with this local name, or null. */
export const findFirst = (node: XmlNode, name: string): XmlNode | null => {
    if (node.name === name) return node
    for (const child of node.children) {
        const found = findFirst(child, name)
        if (found !== null) return found
    }
    return null
}

/** The text of the first descendant with this name, or "" when there is none. */
export const textAt = (node: XmlNode | null, name: string): string =>
    node === null ? "" : (findFirst(node, name)?.text ?? "")

/** Every direct child with this local name. */
export const childrenNamed = (node: XmlNode | null, name: string): Array<XmlNode> =>
    node === null ? [] : node.children.filter((child) => child.name === name)
