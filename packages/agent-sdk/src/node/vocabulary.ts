import { DomainError } from "@starci/common"
import type { NodeDefinition, NodeRole } from "./node.types"

/** The error of the registry: a stable code and the word that caused it. */
export class VocabularyError extends DomainError<"KIND_UNKNOWN" | "KIND_DUPLICATE"> {
    /** The kind, step or provider that caused it. */
    readonly word: string

    constructor(code: "KIND_UNKNOWN" | "KIND_DUPLICATE", word: string) {
        super({ code, params: { at: word } })
        this.word = word
    }
}

/** What a fact of a node kind can hold: its type, unit and allowed values. */
export interface FactSchema {
    /** The type of the value. */
    readonly type: "number" | "string" | "boolean"
    /** The unit of a number, or null. */
    readonly unit: string | null
    /** The values a text may take, or an empty list for any. */
    readonly allowed: ReadonlyArray<string>
}

/** A kind of node a plug-in brings: its steps, the facts its decisions read and the keys of the checks it runs. The core names no domain word. */
export interface NodeKindRegistration {
    /** The key of the kind. */
    readonly kind: string
    /** The steps of the kind. */
    readonly steps: ReadonlyArray<string>
    /** The facts it reads, by key. */
    readonly facts: Readonly<Record<string, FactSchema>>
    /** The keys of its checks. */
    readonly checks: ReadonlyArray<string>
}

/** What a plug-in adds to the words a graph may use. */
export interface NodeVocabularyManifest {
    /** The tool providers a node may use. */
    readonly providers?: ReadonlyArray<string> | undefined
    /** The steps it adds, by the node kind they belong to. */
    readonly steps?: Readonly<Record<string, ReadonlyArray<string>>> | undefined
    /** The kinds of node it brings. */
    readonly kinds?: ReadonlyArray<NodeKindRegistration> | undefined
}

/** The built-in tool providers. A domain adds its own through a plug-in manifest. */
const BUILT_IN_PROVIDERS: ReadonlyArray<string> = ["brain", "drive", "sepay", "zalo", "telegram", "office", "mcp"]

/** The built-in steps of each node kind, the vocabulary the work engine walks. */
const BUILT_IN_STEPS: Readonly<Record<NodeRole, ReadonlyArray<string>>> = {
    trigger: ["customer_message", "tag", "event", "schedule"],
    condition: ["evaluate"],
    execute: ["read_context", "call"],
    output: ["reply", "approval", "write", "stop"],
}

/**
 * The words a graph document may use for its node kinds, steps and tool providers. The built-ins are data here and a plug-in registers
 * more, so no closed list lives in the schema of the core.
 */
export class NodeVocabulary {
    private readonly providers = new Set<string>(BUILT_IN_PROVIDERS)
    private readonly steps = new Map<string, Set<string>>(
        Object.entries(BUILT_IN_STEPS).map(([kind, steps]) => [kind, new Set(steps)]),
    )
    private readonly kinds = new Map<string, NodeKindRegistration>()

    /** Registers the words of a plug-in; a step goes under a kind that exists, and a new kind may not repeat one. */
    add(manifest: NodeVocabularyManifest): void {
        for (const provider of manifest.providers ?? []) this.providers.add(provider)
        for (const [kind, steps] of Object.entries(manifest.steps ?? {})) {
            const known = this.steps.get(kind)
            if (known === undefined) throw new VocabularyError("KIND_UNKNOWN", kind)
            for (const step of steps) known.add(step)
        }
        for (const registration of manifest.kinds ?? []) this.registerKind(registration)
    }

    /** Registers an executable node under its role: its id becomes a step of that role, so a graph may name it. */
    registerNode(node: NodeDefinition): void {
        this.add({ steps: { [node.role]: [node.id] } })
    }

    /** Registers a kind of node with its steps, facts and checks. */
    registerKind(registration: NodeKindRegistration): void {
        if (this.steps.has(registration.kind)) throw new VocabularyError("KIND_DUPLICATE", registration.kind)
        this.steps.set(registration.kind, new Set(registration.steps))
        this.kinds.set(registration.kind, registration)
    }

    /** True when the provider is registered. */
    hasProvider(provider: string): boolean {
        return this.providers.has(provider)
    }

    /** The registered providers. */
    providerNames(): ReadonlyArray<string> {
        return [...this.providers]
    }

    /** True when the node kind exists. */
    hasKind(kind: string): boolean {
        return this.steps.has(kind)
    }

    /** True when the step is registered under any kind. */
    hasStep(step: string): boolean {
        return [...this.steps.values()].some((steps) => steps.has(step))
    }

    /** The steps registered under a kind. */
    stepsOf(kind: string): ReadonlyArray<string> {
        return [...(this.steps.get(kind) ?? [])]
    }

    /** The facts a registered kind reads, by key; none for a built-in kind. */
    factsOf(kind: string): Readonly<Record<string, FactSchema>> {
        return this.kinds.get(kind)?.facts ?? {}
    }

    /** The keys of the checks a registered kind runs; none for a built-in kind. */
    checksOf(kind: string): ReadonlyArray<string> {
        return this.kinds.get(kind)?.checks ?? []
    }
}
