import type { BlockDefinition } from "../block/block.types"
import type { AnyEntityDefinition } from "../entity/entity-any.types"
import { ENTITY_PORT_PREFIX } from "../entity/port/entity-port"
import { specProblems } from "../spec/spec"
import type { SpecNode } from "../spec/spec.types"
import type { ModuleContactBlock, ModuleDeclaration } from "./declaration.types"

/** The one variable a contact block's read takes: the id of the contact whose detail draws the block. */
export const CONTACT_VARIABLE = "contactId"

/** The codes a contact block is refused with, beside the definition errors of `defineModule`. */
export type ContactBlockProblemCode =
    /** The read reaches a record type that has no `contact()` field (or a type nobody declared). */
    | "CONTACT_BLOCK_TYPE_WITHOUT_CONTACT"
    /** The block, its slot or its props do not fit the read (the spec problem is in `detail`). */
    | "CONTACT_BLOCK_SPEC"

/** What is wrong with one contact block, and where. */
export interface ContactBlockProblem {
    /** The id of the contact block. */
    readonly block: string
    /** Which rule it broke. */
    readonly code: ContactBlockProblemCode
    /** The record type, or the spec place `contact-block/<id>[.<slot or prop>]`. */
    readonly at: string
    /** The spec problem code, for `CONTACT_BLOCK_SPEC`. */
    readonly detail?: string
}

/** A placeholder contact id: only the shape of the variable is judged here, never a value. */
const SAMPLE_CONTACT = "00000000-0000-4000-8000-000000000000"

/**
 * The block of a contact block as a spec node: the generic block with its literal props, its slot bound to the module's read and the
 * contact id as the read's one variable. The same node the back end hands the screen, and the one `contactBlockProblems` judges.
 */
export const contactBlockNodeOf = (block: ModuleContactBlock, contactId: string): SpecNode => ({
    id: block.id,
    block: block.block.id,
    ...(block.block.props === undefined ? {} : { props: block.block.props }),
    bind: { [block.block.slot]: { read: block.read, variables: { [CONTACT_VARIABLE]: contactId } } },
})

/** The record types a read reaches through its ports. */
const typesOfRead = (declaration: ModuleDeclaration, readId: string): ReadonlyArray<string> =>
    Object.values(declaration.reads.find((read) => read.id === readId)?.ports ?? {}).flatMap((port) =>
        port.id.startsWith(ENTITY_PORT_PREFIX) ? [port.id.slice(ENTITY_PORT_PREFIX.length)] : [],
    )

/**
 * What is wrong with the contact blocks of a module against the installed blocks and the declared record types: a read whose record
 * type has no `contact()` field (the rows would have no person to belong to), and every `specProblems` finding of the block as the
 * contact detail draws it (an unknown block, a slot it lacks, a read of another shape or data kind, props the block refuses). Empty when
 * every contact block may be drawn. Apart from `defineModule`, like `seedSpecProblems`, so a declaration never imports the blocks.
 */
export const contactBlockProblems = (
    declaration: ModuleDeclaration,
    blocks: ReadonlyArray<BlockDefinition>,
    entities: ReadonlyArray<AnyEntityDefinition>,
): ReadonlyArray<ContactBlockProblem> =>
    (declaration.contactBlocks ?? []).flatMap((block): ReadonlyArray<ContactBlockProblem> => {
        const types = typesOfRead(declaration, block.read).flatMap((name): ReadonlyArray<ContactBlockProblem> => {
            const entity = entities.find((candidate) => candidate.name === name)
            const hasContact = Object.values(entity?.fields ?? {}).some((one) => one.kind === "contact")
            return hasContact ? [] : [{ block: block.id, code: "CONTACT_BLOCK_TYPE_WITHOUT_CONTACT", at: name }]
        })
        const spec = specProblems(
            {
                schema: "nivo/workbench-spec@1",
                module: declaration.key,
                views: [{ id: "contact-block", label: block.title, root: contactBlockNodeOf(block, SAMPLE_CONTACT) }],
            },
            blocks,
            { reads: declaration.reads, actions: declaration.actions, permissions: declaration.permissions },
        ).map(
            (problem): ContactBlockProblem => ({
                block: block.id,
                code: "CONTACT_BLOCK_SPEC",
                at: problem.at,
                detail: problem.code,
            }),
        )
        return [...types, ...spec]
    })
