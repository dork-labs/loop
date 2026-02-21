import { Hono } from 'hono'
import { generateOpenApiDocument } from '../lib/openapi-schemas'

export const openapiRoutes = new Hono()

openapiRoutes.get('/', (c) => {
  return c.json(generateOpenApiDocument())
})
