import type { NivoItemInput } from "./nivo-knowledge.contracts"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { NivoKnowledgeErrorCode } from "./errors/nivo-knowledge.error"

/** The kinds a base knowledge item may have. */
const KINDS: ReadonlyArray<string> = ["playbook", "authority", "escalation", "setup_checklist", "tone"]

/** The folder of the knowledge every module shares. */
export const CORE_FOLDER = "core"

/** One base knowledge file: its path under the knowledge folder (forward slashes) and its text. */
export interface NivoFile {
    /** The path under the knowledge folder, e.g. `chatbot/chatbot-tone.md`. */
    readonly path: string
    /** The text of the file. */
    readonly text: string
}

/** What reading one base knowledge file gives: the item, or the code of why the file is refused. */
export type NivoItemOutcome = Outcome<NivoItemInput, NivoKnowledgeErrorCode>

/** The key/value pairs of the front matter block. */
const metaOf = (block: string): ReadonlyMap<string, string> => {
    const meta = new Map<string, string>()
    block.split("\n").forEach((line) => {
        const match = /^(\w+):\s*(.*)$/.exec(line)
        if (match !== null) meta.set(match[1] ?? "", (match[2] ?? "").trim().replace(/^["']|["']$/g, ""))
    })
    return meta
}

/**
 * Reads one base knowledge file: a front matter block with a title and a kind, then the markdown body. The module is the folder the
 * file sits in, which must be `core` or the knowledge folder of a module of the catalogue; the slug is the file name.
 */
export const nivoItemOf = (file: NivoFile, folders: ReadonlyArray<string>): NivoItemOutcome => {
    const raw = file.text.replace(/\r\n/g, "\n")
    const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw)
    if (match === null) return refused(NivoKnowledgeErrorCode.FrontMatterMissing, { file: file.path })
    const meta = metaOf(match[1] ?? "")
    const parts = file.path.split("/")
    const module = parts[0] ?? ""
    if (parts.length < 2 || !folders.includes(module)) {
        return refused(NivoKnowledgeErrorCode.ModuleUnknown, { file: file.path })
    }
    const kind = meta.get("kind") ?? ""
    if (!KINDS.includes(kind)) return refused(NivoKnowledgeErrorCode.KindUnknown, { file: file.path })
    const title = meta.get("title") ?? ""
    if (title === "") return refused(NivoKnowledgeErrorCode.TitleMissing, { file: file.path })
    const name = parts[parts.length - 1] ?? ""
    return ok({ module, slug: name.replace(/\.md$/, ""), title, kind, body: (match[2] ?? "").trim() })
}
