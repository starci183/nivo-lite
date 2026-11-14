# @nivo-lite/agent-sdk

The one SDK every Nivo agent kind is built on. A module is a package on this SDK: its **template**, its **node registrations** and its
**workbench**. The app imports the module list and provides the host; it holds no module code. The SDK holds no concrete block: those
are packages built on it, the core ones in `@nivo-lite/blocks-core`.

## Subpaths

Each subpath is one entry of the `exports` of the package manifest; a side imports the package by these names and never past them.

| subpath                               | side                 | holds                                                                                                                                                                                               |
| ------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@nivo-lite/agent-sdk`                | React-free           | the module list checks `moduleListProblems` and `templatesOf`                                                                                                                                       |
| `@nivo-lite/agent-sdk/schema`         | React-free           | `SpecText`, `Namespaced`, `JsonValue`, the `specText` zod schema, `isNamespaced`, `namespaceOf`, `wordsOf`                                                                                          |
| `@nivo-lite/agent-sdk/rights`         | React-free           | `DataRight`, `RightsGrant` and `rightsGaps`: default deny, never a wildcard field                                                                                                                   |
| `@nivo-lite/agent-sdk/block`          | React-free           | `defineBlock`, `defineRead`, `defineAction`, the read and action handles a block receives, `BlockHost`, `SdkDefinitionError`                                                                        |
| `@nivo-lite/agent-sdk/node`           | React-free           | `defineNode`, the node context, `NodeVocabulary`, `RightsDeniedError`, `VocabularyError`                                                                                                            |
| `@nivo-lite/agent-sdk/spec`           | React-free           | the spec document (`nivo/workbench-spec@1`): `specDocumentSchema`, `specProblems`, `renderPlan`, `viewOf`                                                                                           |
| `@nivo-lite/agent-sdk/module`         | React-free           | `ModuleTemplate`, `ModuleServer`, `defineModule` and the module declaration types, `templatesOf`                                                             |
| `@nivo-lite/agent-sdk/template`       | React-free           | the agent template package: `previewPackage`, `instantiate`, `resolveValues`, `updateUnits`, `applyUnits`, `canonicalJson`                                                                          |
| `@nivo-lite/agent-sdk/testing`        | React-free           | the doubles and builders a spec of a block, a node or a template uses                                                                                                                               |
| `@nivo-lite/agent-sdk/client`         | React (Grammar only) | the spec renderer: `SpecWorkbench`, `WorkbenchHostProvider`, `SlotView`, `defineRenderer`, the data slots, and the English and Vietnamese message catalogues of the renderer under the same subpath |
| `@nivo-lite/agent-sdk/workbench/view` | React-free           | the view types of the shared workbench regions                                                                                                                                                      |

The sources sit under `src` in one folder per subpath (`src/block`, `src/node`, `src/spec`, `src/module`, `src/template`, `src/tests/fixtures`,
`src/rights`, `src/schema`, `src/client`, `src/workbench`), with `src/slot`, `src/host` and `src/sdk-error.ts` shared between them.

## Code and data

The split is WordPress-like and it is the rule every subpath follows.

- **Code** lives in the build-time registry of packages: node kinds, blocks, reads, actions and their components. It is reviewed,
  versioned with the package and never stored in or loaded from the database.
- **Data** lives in the database: templates, installations, parameters, module documents and **workbench specs**: a screen as a tree of
  registered blocks with bindings to the reads and actions a module exposes, like a block layout in a post. A spec can recompose a
  workbench without a deploy; it can never add a behaviour, because every block, read and action it names must already be code in the
  registry, which `specProblems` checks.

## Defining code

```ts
const figures = defineBlock({
  id: "core.figures",
  title: { key: "blockFigures" },
  props: z.object({ label: specText }),
  slots: { data: { kind: "read", shape: "record", required: true } },
  children: false,
})
```

- A block, a read and an action are plain data with a registry id `<namespace>.<name>`; the define function checks the id and that the
  props or variables convert to JSON Schema, and throws `SdkDefinitionError` at module load otherwise, so a bad definition fails its own
  package and never a request.
- A read runs a host operation under the VIEWER's session and rights; a block never sees more than the viewer may see.
- A node (`defineNode`) is an executable step of an agent graph. It declares the rights it needs and the effect kinds it may record, and
  it reaches records only through a data port that checks every call against the agent's grant. Without a right the call is refused
  with `RightsDeniedError`.
- Every refusal the SDK throws is a `DomainError` of `@starci/common` and carries a stable code (`code`) and the id or word it is about (`params.at`); its message is the code.

## The spec (data)

A spec document names its schema and its module, and holds views; each view is a tree of nodes.

```json
{
  "schema": "nivo/workbench-spec@1",
  "module": "sales",
  "views": [
    {
      "id": "orders",
      "label": { "key": "tabOrders" },
      "root": {
        "id": "root",
        "block": "core.stack",
        "props": { "gap": "region" },
        "children": [
          {
            "id": "list",
            "block": "core.record-list",
            "props": {
              "label": { "vi": "Don hang", "en": "Orders" },
              "empty": { "key": "ordersEmpty" },
              "idPath": "id",
              "titlePath": "customer"
            },
            "bind": { "rows": { "read": "sales.orders", "path": "orders" } }
          }
        ]
      }
    }
  ]
}
```

- A text is a message key of the module's namespace or owner-written words in both product languages.
- A binding names a read or an action; a read declares its shape (`record`, `list`, `value`) and the paths a binding may narrow to, so a
  list is never bound where one record is drawn.
- `specProblems(document, blocks, bindings)` refuses an unknown schema, no view, duplicate view or node ids, nesting deeper than the
  depth bound, an unknown block, an unknown, missing or mistyped prop, an unknown or missing slot, a binding of the wrong kind or shape,
  an unknown read or action, an unexposed path, an unknown permission and children a block does not accept. The back end runs it before
  it saves a version; the front end runs it again before drawing.
- `renderPlan` turns a valid document into the plan the renderer draws, with the props of every node parsed by its block's schema.
- The schemas are bounded: every text, list and keyed collection of a document has an upper bound, so a stored document cannot cost
  more than a known amount to read.

## Drawing a spec

The app provides a `WorkbenchHost`: the ports a block reaches (words, navigation, toasts, defect reports) and the hooks the renderer
uses to run a read, run an action and ask a permission. `SpecWorkbench` draws a published document with it: the tabs of its views, the
chosen view's tree, and for each node the component registered for its block with `defineRenderer`. Every read reaches a block as a
`DataSlot` (loading, forbidden, error, empty or ready), and a block draws every status through `SlotView`. A block the registry no
longer holds draws nothing, and a node whose component fails is held by its own boundary.

A module imports `react`, `@starci/grammar` and `@nivo-lite/agent-sdk` and nothing else at runtime: no data client, no router, no
message library, no app path.

## Modules

- A module is declared with `defineModule` (`ModuleDeclaration`): its reads, actions, permissions, seed specs and, when it has an agent, the agent's tool set. The agent's words are the module's craft, held by its package (the plugin's `guidance` function), not by the declaration.
- `ModuleTemplate` and `ModuleServer` are the catalogue entry as React-free code, so a back end loads it; `templatesOf` lists them in
  catalogue order and throws `ModuleListError` for a list with a duplicate key, a key that does not match its template, an action
  defined twice or a command that names an action the module does not govern.

## Templates

A marketplace template is a package of a graph with parameters. `previewPackage` rebuilds a creator's graph by an allowlist, so the
package carries no id, address, secret, person, chat, private source or data right of the creator, and reports what it left out.
`instantiate` writes the buyer's parameter values into a copy. `updateUnits` and `applyUnits` merge a new version into a graph the buyer
may have edited, one unit per node or branch, and move only the units the buyer accepts.

## Testing

`@nivo-lite/agent-sdk/testing` is the public kit for the specs of a block, a node and a template, so a module package tests against the
same doubles as the SDK:

- the data-status slots, read and action handles that record what a block did, a block host and a workbench host;
- a node context over an in-memory store that enforces the grant the way the host does;
- a builder for a graph, a draft and a package, and a vocabulary with an extra kind.

The specs of the SDK sit beside their subjects and hold every logic file at 100 per file on lines, branches, functions and statements.
