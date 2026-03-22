# Product

`auth-service-oauth-jwt` is a Node.js authentication service that handles OAuth 2.0 flows (Google, GitHub) and issues RS256-signed JWTs for session management.

It exposes HTTP endpoints for:
- Initiating OAuth authorization and handling provider callbacks
- Verifying, refreshing, and revoking JWT access tokens

Secrets and configuration are loaded exclusively from environment variables. The service supports two token storage backends: Redis (production) and in-memory Map (dev/test).
