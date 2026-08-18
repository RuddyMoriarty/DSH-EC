/**
 * Deterministic loopback HTTP fixture for the Moriarty revue-de-portefeuille
 * snapshot: the six moriarty-be GET routes the HTTP provider calls, on a fixed
 * port, so recording and keyless replay drive the REAL `dsh-moriarty-api-http`
 * transport and `dsh-tool-moriarty` formatting without contacting
 * api.themoriarty.app. The port is fixed because `baseURL` is part of the
 * overlay; tool results cite path-only `Source:` lines.
 */
import { createServer } from 'node:http'

/** Fixed loopback port the overlay points `moriarty-api-http.baseURL` at. */
const PORT = 43118

const ORG = {
  id: 'org-cabinet-fixture',
  name: 'cabinet-snapshot',
  displayName: 'Cabinet Snapshot',
}

const ALPHA = {
  id: 'biz-alpha',
  name: 'SARL Alpha',
  organizationId: ORG.id,
  archived: false,
  tags: [],
  auditUpdatedAt: '2026-01-15T10:00:00.000Z',
  siret: '12345678901234',
  socialReason: 'SARL Alpha',
}

const BETA = {
  id: 'biz-beta',
  name: 'SAS Beta',
  organizationId: ORG.id,
  archived: false,
  tags: [],
  auditUpdatedAt: '2026-02-01T10:00:00.000Z',
}

const DIAGNOSTIC_ALPHA = {
  id: 'diag-alpha-1',
  businessId: ALPHA.id,
  businessName: ALPHA.name,
  status: 'DONE',
  diagnosticType: 'AIDES',
  startedAt: '2026-03-01T08:00:00.000Z',
  completedAt: '2026-03-01T08:05:00.000Z',
  totalEligible: 2,
}

const EMPTY_PAGE = { content: [], totalElements: 0, number: 0, size: 0, empty: true }

const ROUTES = new Map([
  ['GET /v1/organizations/me', { status: 200, body: [ORG] }],
  [`GET /v1/businesses/${ORG.id}/list`, {
    status: 200,
    body: { content: [ALPHA, BETA], totalElements: 2, number: 0, size: 2, empty: false },
  }],
  [`GET /v1/businesses/${ORG.id}/${ALPHA.id}`, { status: 200, body: ALPHA }],
  [`GET /v1/businesses/${ORG.id}/${BETA.id}`, { status: 200, body: BETA }],
  [`GET /v1/businesses/${ORG.id}/${ALPHA.id}/diagnostics/latest`, { status: 200, body: DIAGNOSTIC_ALPHA }],
  [`GET /v1/capsule/${ORG.id}/${ALPHA.id}/files`, { status: 200, body: EMPTY_PAGE }],
  [`GET /v1/capsule/${ORG.id}/${BETA.id}/files`, { status: 200, body: EMPTY_PAGE }],
  ['GET /v1/france-aides', { status: 200, body: EMPTY_PAGE }],
])

/** Cordis plugin name. */
export const name = 'moriarty-api-fixture-server'

/**
 * Start the fixture server on 127.0.0.1 and register its shutdown.
 * @param ctx - Cordis context; the effect disposes the server with the fiber.
 */
export async function apply(ctx) {
  const server = createServer((req, res) => {
    const authorization = req.headers.authorization
    if (authorization !== 'Bearer snapshot-token') {
      res.writeHead(401, { 'content-type': 'application/json; charset=utf-8' })
      res.end('{"error":"unauthorized"}')
      return
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const key = `${req.method ?? 'GET'} ${url.pathname}`
    if (key === `GET /v1/businesses/${ORG.id}/${BETA.id}/diagnostics/latest`) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
      res.end('{"error":"not found"}')
      return
    }
    const route = ROUTES.get(key)
    if (route === undefined) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    res.writeHead(route.status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(route.body))
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORT, '127.0.0.1', () => resolve(undefined))
  })
  // The fixture must never hold the process open past protocol shutdown.
  server.unref()
  ctx.effect(() => async () => {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve(undefined))
      // Stop accepting first so a connection cannot arrive after the forced close.
      server.closeAllConnections()
    })
  }, 'moriarty-api-fixture-server')
}
