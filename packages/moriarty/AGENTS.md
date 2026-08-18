# AGENTS.md — Moriarty Packages

These rules supplement the package conventions in [packages/AGENTS.md](../AGENTS.md).

- **Reject redirects on credential-bearing provider requests.** Configure the HTTP client to fail before following any redirect response. Regression coverage must prove that the redirect target is not contacted. The configured endpoint necessarily receives the initial request; this prevents automatic forwarding of the user JWT to another origin.
- **Never invent `/v1/agent`.** Map only endpoints moriarty-be already publishes. A new backend route is a moriarty-be change, not a harness invention.
- **Use the user JWT, never `ADMIN_API_KEY`.** The HTTP provider resolves `MORIARTY_ACCESS_TOKEN` (or the configured credential ref) per request.
