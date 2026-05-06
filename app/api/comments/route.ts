import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL,
      nickname TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `

  const rows = await sql`
    SELECT id, nickname, body, created_at
    FROM comments
    WHERE slug = ${slug}
    ORDER BY created_at ASC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const { slug, nickname, password, body } = await req.json()
  if (!slug || !nickname?.trim() || !password || !body?.trim()) {
    return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
  }
  if (nickname.trim().length > 20) {
    return NextResponse.json({ error: '닉네임은 20자 이내로 입력해주세요.' }, { status: 400 })
  }
  if (body.trim().length > 1000) {
    return NextResponse.json({ error: '댓글은 1000자 이내로 입력해주세요.' }, { status: 400 })
  }

  const sql = getDb()
  const hash = await bcrypt.hash(password, 10)
  const [row] = await sql`
    INSERT INTO comments (slug, nickname, password_hash, body)
    VALUES (${slug}, ${nickname.trim()}, ${hash}, ${body.trim()})
    RETURNING id, nickname, body, created_at
  `
  return NextResponse.json(row, { status: 201 })
}
