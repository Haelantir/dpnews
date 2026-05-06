import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { password } = await req.json()
  if (!password) return NextResponse.json({ error: '비밀번호를 입력해주세요.' }, { status: 400 })

  const sql = getDb()
  const [row] = await sql`SELECT password_hash FROM comments WHERE id = ${id}`
  if (!row) return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 })

  const ok = await bcrypt.compare(password, row.password_hash)
  if (!ok) return NextResponse.json({ error: '비밀번호가 틀렸습니다.' }, { status: 403 })

  await sql`DELETE FROM comments WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
