# Notification authentication compatibility

NodeWarden's bundled web app negotiates a signed, single-use WebSocket ticket.
Tickets expire after 60 seconds, and the Durable Object consumes them atomically.
This remains the default browser authentication path.

Official Bitwarden JavaScript clients currently use SignalR with
`skipNegotiation: true` and `accessTokenFactory`. Browser WebSocket APIs cannot
set an Authorization header, so those clients send `access_token` in the URL.
With the default configuration, NodeWarden rejects that request with HTTP 401.

Sources checked on 2026-09-12:

- [Bitwarden SignalR implementation at e40ce6f](https://github.com/bitwarden/clients/blob/e40ce6f08ebf963db3561464e77b4defe05247e8/libs/common/src/platform/server-notifications/internal/signalr-connection.service.ts)
- [Microsoft SignalR authentication documentation](https://learn.microsoft.com/en-us/aspnet/core/signalr/authn-and-authz?view=aspnetcore-10.0)

## Explicit compatibility option

`ALLOW_LEGACY_NOTIFICATION_QUERY_TOKEN` is disabled unless its value is exactly
`"1"`. Enabling it permits a valid query JWT only on HTTPS GET WebSocket upgrades
to `/notifications/hub`.

After accepting the URL exposure risk, add this to the deployment configuration:

```toml
[vars]
ALLOW_LEGACY_NOTIFICATION_QUERY_TOKEN = "1"
```

The current promotion explicitly enables this setting in `wrangler.toml` after
operator acceptance. On this fork, production configuration is generated from
that file; pushing `custom` automatically deploys the Worker. Remove the setting
or set it to `"0"` to disable it through a reviewed deployment.

## Authentication rules

1. An explicit Authorization header takes priority. Invalid headers fail without
   falling back to a query JWT or ticket.
2. An explicit `id` ticket takes priority over `access_token`. Invalid, empty,
   duplicate, expired, or consumed tickets cannot fall back to a query JWT.
3. Otherwise the query JWT requires the compatibility option, one nonempty
   `access_token`, HTTPS, and the existing AuthService checks for the JWT,
   account status, security stamp, and device session. Existing AuthService
   cache behavior is unchanged.
4. Query JWTs cannot authenticate negotiation or ordinary API routes.
5. Before forwarding an authenticated request, the Worker removes all query
   parameters and the Authorization header. It then adds only the verified
   user/device identity required by the Durable Object. Caller-supplied `nw_*`
   identity parameters are discarded.

NodeWarden's bundled web app continues to negotiate tickets even when this
option is enabled. The anonymous authentication-request hub is unchanged.

## Residual exposure

Removing credentials before Durable Object forwarding does not remove the JWT
from the request originally received by Cloudflare, proxies, client diagnostics,
or other ingress infrastructure. TLS protects transport but does not prevent
those systems from retaining URLs. This option restores compatibility with
clients that require query JWTs; it does not provide the same exposure reduction
as negotiated tickets. Review URL logging and retention before enabling it.

## Validation and production gate

`bun run test` includes default-off and opt-in authentication tests, invalid
credentials, downgrade prevention, credential stripping, and isolated Miniflare
tests using the actual Worker, D1, and Durable Object implementations. The
runtime tests exercise MessagePack handshakes/reconnects, concurrent ticket
consumption, replay, storage expiry, alarm cleanup, and a cipher update that
persists cleared fields and emits a notification. All data is synthetic and
outbound requests are blocked by the test harness.

The review validation workflow also runs the separate compatibility suites,
both TypeScript projects, localization validation, dependency audit, and build.

These checks do not establish authenticated compatibility with every installed
desktop/mobile client. During promotion, verify real client vault sync,
notification delivery/reconnect, cipher edit/clear round-trips, and backup
behavior before mirroring the clean upstream branch.

To disable compatibility, remove the option or set it to `"0"`, deploy through
the same reviewed workflow, and verify that fresh query-token connections are
rejected. Existing WebSocket sessions may remain until disconnected.
