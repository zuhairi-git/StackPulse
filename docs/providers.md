# Adding providers to StackPulse

Settings → Providers & integrations lists the adapters bundled with the app. Users can activate or deactivate each platform and add multiple accounts. Existing platforms are active on first use. Activation preferences persist on the device. Deactivation cancels in-flight requests, excludes all of that platform's accounts from manual/automatic refresh and resource views, and preserves credentials and cached snapshots for reactivation.

Accounts belong to a workspace. Adding an account uses the selected workspace; dashboard views and refreshes include only that workspace's active accounts. Provider activation remains global across workspaces. Keep connection IDs stable when moving accounts so credentials, tokens held in memory, and snapshots stay attached to the same account.

To add a future integration:

1. Add a GET-only inventory adapter under `src/providers/`, using `read()` from `http.ts`. Return validated resources, a note describing inventory/freshness limitations, and an optional account name. Keep pagination bounded and document it.
2. Register it in `src/providers/registry.ts` using the `ProviderDefinition` contract. Supply its name, category, resource label, official dashboard/documentation/token links, scope labels/help, permission guidance, browser probe URL, and adapter. Set `requiresBrowserCheck: true` unless browser support has been verified. Use `defaultEnabled: false` for new optional integrations.
3. If inventory does not expose the account name, supply optional `discoverName(token, scope, signal)`. Discovery failures must not prevent successful inventory refresh. A short deadline bounds this optional request; never increase permissions just to display a name.
4. Add fixture-based tests for validation, account scoping, names, failures, and request restrictions. Verify direct browser access from the deployed origin with a least-privilege token.
5. Build and publish. The registry automatically supplies the provider type, Settings listing, activation controls, connection form, account cards, resource filters, refresh routing, and browser-access check. A generic icon works without UI changes; an optional branded icon can be added to `Logo` in `App.tsx`.

The catalog contains reviewed, compiled adapters. Users activate integrations from Settings; they cannot enter arbitrary API endpoints or install executable plugins. Tokens must only go to the selected provider's official API. New adapters do not require changes to the database schema or existing connection IDs.
