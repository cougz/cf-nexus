import type { Context, Next } from 'hono'

interface RateLimitOptions {
  windowMs: number
  maxRequests: number
}

interface RateLimitInfo {
  count: number
  resetTime: number
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowMs: 60000, // 1 minute
  maxRequests: 100,
}

export function rateLimit(options: Partial<RateLimitOptions> = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  return async (c: Context, next: Next) => {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'

    const now = Date.now()
    const key = `ratelimit:${ip}`

    try {
      const cached = await c.env.KV.get(key)

      let info: RateLimitInfo

      if (cached) {
        info = JSON.parse(cached) as RateLimitInfo

        if (now > info.resetTime) {
          info = { count: 0, resetTime: now + opts.windowMs }
        }
      } else {
        info = { count: 0, resetTime: now + opts.windowMs }
      }

      info.count++

      const ttl = Math.floor((info.resetTime - now) / 1000)

      await c.env.KV.put(key, JSON.stringify(info), { expirationTtl: ttl })

      const remaining = Math.max(0, opts.maxRequests - info.count)

      c.header('X-RateLimit-Limit', opts.maxRequests.toString())
      c.header('X-RateLimit-Remaining', remaining.toString())
      c.header('X-RateLimit-Reset', Math.floor(info.resetTime / 1000).toString())

      if (remaining === 0) {
        return c.json(
          {
            error: {
              message: 'Too many requests',
              code: 'RATE_LIMIT_EXCEEDED',
            },
          },
          { status: 429 }
        )
      }

      await next()
    } catch (err) {
      console.error('Rate limit error:', err)
      await next()
    }
  }
}
