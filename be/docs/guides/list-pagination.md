# Main list pagination

`leadBoard`, `workThreads` and `salesOrders` return a connection with `nodes` and `pageInfo`. All three use the shared backend `Connection<T>` and `PageInfo` contracts and pagination policy. Each feature owns its thin GraphQL representation (`LeadBoardPageInfo`, `WorkThreadPageInfo` or `SalesOrderPageInfo`) because transport DTOs stay inside their feature boundary. Their input accepts `first` and `after`; `workThreads` also accepts its existing optional `leadId` filter. The input DTOs share the default and maximum page size constants.

```graphql
query Leads($input: LeadBoardInput) {
  leadBoard(input: $input) {
    nodes {
      id
      contactName
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
```

Start with `{ "input": { "first": 50 } }`. To continue, send the returned `endCursor` as `after` with the same workspace and filters. Stop when `hasNextPage` is false. An empty page returns `endCursor: null` and `hasNextPage: false`; a nonempty final page still has an end cursor.

The default page size is 50, and `first` must be an integer from 1 through 100. The `input` argument defaults to an empty object and, when supplied, must be an object. Omitted or null `first` and `after` fields use the defaults. Cursors are opaque, versioned, and scoped to the workspace, list and applicable filters. Invalid, oversized or foreign cursors are rejected as `HTTP_SECURITY_REQUEST_INVALID`.

All three lists sort by creation time descending, then unique ID descending. Work threads consequently keep their creation order when a message changes their update time. The cursor preserves PostgreSQL's full timestamp precision, and each query reads one extra row to determine whether a next page exists. A newer row inserted between requests appears when the list is refreshed; it does not shift the continuation into duplicates. Pagination reads current data on each request rather than holding a database snapshot.

The web lead board, work thread board and sales orders section append pages with a Load more action. Changing the active workspace starts a fresh connection. Existing search and stage filters on the lead board apply to the loaded leads; Load more remains available while the server has further leads. API callers changing the thread's `leadId` filter must start without a cursor.
