import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for the frontend
app.use('/api/*', cors({
  origin: '*', // Allows all origins (good for MVP/testing)
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}))

// Simple password hashing using Web Crypto API (SHA-256 for MVP)
async function hashPassword(password: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

app.post('/api/auth/register', async (c) => {
  try {
    const { email, password } = await c.req.json()
    if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

    const hashedPassword = await hashPassword(password)
    const id = crypto.randomUUID()

    await c.env.DB.prepare(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
    ).bind(id, email, hashedPassword).run()

    return c.json({ message: 'User created' }, 201)
  } catch (e: any) {
    if (e.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'Email already exists' }, 400)
    }
    return c.json({ error: 'Server error' }, 500)
  }
})

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first<{ id: string, password_hash: string }>()

  if (!user) return c.json({ error: 'Invalid credentials' }, 401)

  const hashedPassword = await hashPassword(password)
  if (hashedPassword !== user.password_hash) return c.json({ error: 'Invalid credentials' }, 401)

  const secret = c.env.JWT_SECRET || 'fallback-secret-for-local-dev'
  const token = await sign({ id: user.id }, secret)

  return c.json({ token, userId: user.id })
})

// Protected Routes Middleware
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth')) {
    return next()
  }

  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized: Missing or Invalid Auth Header format' }, 401)
  }

  const token = authHeader.split(' ')[1]
  try {
    const secret = c.env.JWT_SECRET || 'fallback-secret-for-local-dev'
    const payload = await verify(token, secret, 'HS256')
    c.set('userId', payload.id)
    await next()
  } catch (e: any) {
    return c.json({ error: 'Unauthorized: Token Verification Failed' }, 401)
  }
})

// --- CATEGORIES ---
app.get('/api/categories', async (c) => {
  const userId = c.get('userId' as any)
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM categories WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(userId).all()
  return c.json({ categories: results })
})

app.post('/api/categories', async (c) => {
  const userId = c.get('userId' as any)
  const { name, type } = await c.req.json()
  if (!name || !type) return c.json({ error: 'Missing fields' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO categories (id, user_id, name, type) VALUES (?, ?, ?, ?)'
  ).bind(id, userId, name, type).run()
  return c.json({ message: 'Category created', id, name, type }, 201)
})

app.delete('/api/categories/:id', async (c) => {
  const userId = c.get('userId' as any)
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').bind(id, userId).run()
  return c.json({ message: 'Category deleted' })
})

// --- RECURRING TRANSACTIONS ---
app.get('/api/recurring', async (c) => {
  const userId = c.get('userId' as any)
  const { results } = await c.env.DB.prepare(`
    SELECT rt.*, c.name as category_name 
    FROM recurring_transactions rt 
    LEFT JOIN categories c ON rt.category_id = c.id 
    WHERE rt.user_id = ? ORDER BY rt.created_at DESC
  `).bind(userId).all()
  return c.json({ recurring_transactions: results })
})

app.post('/api/recurring', async (c) => {
  const userId = c.get('userId' as any)
  const body = await c.req.json()
  const { amount, type, category_id, expense_type, description, frequency, start_date } = body
  if (!amount || !type || !description || !frequency || !start_date) return c.json({ error: 'Missing fields' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO recurring_transactions (id, user_id, amount, type, category_id, expense_type, description, frequency, start_date, next_date) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, userId, Number(amount), type, category_id || null, expense_type || null, description, frequency, start_date, start_date).run()
  return c.json({ message: 'Recurring transaction created', id }, 201)
})

app.delete('/api/recurring/:id', async (c) => {
  const userId = c.get('userId' as any)
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?').bind(id, userId).run()
  return c.json({ message: 'Recurring transaction deleted' })
})

// --- TRANSACTIONS ---
app.get('/api/transactions', async (c) => {
  const userId = c.get('userId' as any)
  const { results } = await c.env.DB.prepare(`
    SELECT t.*, c.name as category_name 
    FROM transactions t 
    LEFT JOIN categories c ON t.category_id = c.id 
    WHERE t.user_id = ? ORDER BY t.created_at DESC
  `).bind(userId).all()

  const balance = results.reduce((acc: number, tx: any) => acc + (tx.type === 'income' ? tx.amount : -tx.amount), 0)
  return c.json({ transactions: results, balance })
})

app.post('/api/transactions', async (c) => {
  const userId = c.get('userId' as any)
  const { amount, type, category_id, expense_type, description } = await c.req.json()
  if (!amount || !type || !description) return c.json({ error: 'Missing fields' }, 400)

  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO transactions (id, user_id, amount, type, category_id, expense_type, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, userId, Number(amount), type, category_id || null, expense_type || null, description).run()
  return c.json({ message: 'Transaction created', id }, 201)
})

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: Bindings, ctx: any) {
    console.log("Cron triggered:", event.cron)
    const today = new Date().toISOString().split('T')[0]
    
    // Find due recurring transactions
    const { results } = await env.DB.prepare(`
      SELECT * FROM recurring_transactions WHERE status = 'active' AND next_date <= ?
    `).bind(today).all()

    for (const rt of results as any[]) {
      const id = crypto.randomUUID()
      const desc = `[Auto] ${rt.description}`
      
      // Execute transaction insertion
      await env.DB.prepare(
        'INSERT INTO transactions (id, user_id, amount, type, category_id, expense_type, description) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, rt.user_id, rt.amount, rt.type, rt.category_id, rt.expense_type, desc).run()

      // Calculate next_date based on UTC standard to avoid timezone pitfalls
      const nextDate = new Date(rt.next_date)
      if (rt.frequency === 'daily') nextDate.setUTCDate(nextDate.getUTCDate() + 1)
      if (rt.frequency === 'weekly') nextDate.setUTCDate(nextDate.getUTCDate() + 7)
      if (rt.frequency === 'monthly') nextDate.setUTCMonth(nextDate.getUTCMonth() + 1)
      if (rt.frequency === 'yearly') nextDate.setUTCFullYear(nextDate.getUTCFullYear() + 1)
      
      const newNextDateStr = nextDate.toISOString().split('T')[0]
      await env.DB.prepare(
        'UPDATE recurring_transactions SET next_date = ? WHERE id = ?'
      ).bind(newNextDateStr, rt.id).run()
    }
  }
}
