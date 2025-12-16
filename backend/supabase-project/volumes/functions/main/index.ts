/**
 * -----------------------------------------------------------------------------
 * @name        main
 * @description *** CRITICAL INFRASTRUCTURE: DO NOT DELETE OR MODIFY ***
 * * This is the central gateway for the Supabase Edge Function environment. 
 * Its primary responsibilities are universal security (optional JWT validation)
 * and dynamically routing the request to the correct sub-function worker 
 * (service) defined by the URL path.
 * -----------------------------------------------------------------------------
 * @method      ANY (Routes all methods to the appropriate sub-function)
 * @base_url    /functions/v1/{service_name}
 * -----------------------------------------------------------------------------
 * @security    Conditional JWT Authentication:
 * - Checks the VERIFY_JWT environment variable.
 * - If true, it validates the request's 'Bearer' token using the JWT_SECRET.
 * - If token is invalid or missing, it returns 401 Unauthorized before routing.
 * @routing     Dynamic Worker Dispatch:
 * - Reads the service name from the URL path.
 * - Creates a user worker process (via EdgeRuntime) for the corresponding 
 * service and passes the request to it.
 * -----------------------------------------------------------------------------
 * @env         JWT_SECRET (Used to verify JWT signatures)
 * @env         VERIFY_JWT (Boolean flag: 'true' enables authentication)
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

console.log('main function started')

const JWT_SECRET = Deno.env.get('JWT_SECRET')
const VERIFY_JWT = Deno.env.get('VERIFY_JWT') === 'true'

function getAuthToken(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    throw new Error('Missing authorization header')
  }
  const [bearer, token] = authHeader.split(' ')
  if (bearer !== 'Bearer') {
    throw new Error(`Auth header is not 'Bearer {token}'`)
  }
  return token
}

async function verifyJWT(jwt: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const secretKey = encoder.encode(JWT_SECRET)
  try {
    await jose.jwtVerify(jwt, secretKey)
  } catch (err) {
    console.error(err)
    return false
  }
  return true
}

serve(async (req: Request) => {
  if (req.method !== 'OPTIONS' && VERIFY_JWT) {
    try {
      const token = getAuthToken(req)
      const isValidJWT = await verifyJWT(token)

      if (!isValidJWT) {
        return new Response(JSON.stringify({ msg: 'Invalid JWT' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch (e) {
      console.error(e)
      return new Response(JSON.stringify({ msg: e.toString() }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const url = new URL(req.url)
  const { pathname } = url
  const path_parts = pathname.split('/')
  const service_name = path_parts[1]

  if (!service_name || service_name === '') {
    const error = { msg: 'missing function name in request' }
    return new Response(JSON.stringify(error), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const servicePath = `/home/deno/functions/${service_name}`
  console.error(`serving the request with ${servicePath}`)

  const memoryLimitMb = 150
  const workerTimeoutMs = 1 * 60 * 1000
  const noModuleCache = false
  const importMapPath = null
  const envVarsObj = Deno.env.toObject()
  const envVars = Object.keys(envVarsObj).map((k) => [k, envVarsObj[k]])

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb,
      workerTimeoutMs,
      noModuleCache,
      importMapPath,
      envVars,
    })
    return await worker.fetch(req)
  } catch (e) {
    const error = { msg: e.toString() }
    return new Response(JSON.stringify(error), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
