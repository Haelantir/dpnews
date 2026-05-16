import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.SANITY_REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const slug: string | undefined = body?._id && body?.slug?.current

  revalidatePath('/blog', 'page')
  if (slug) revalidatePath(`/blog/${slug}`, 'page')

  return NextResponse.json({ revalidated: true, slug: slug ?? 'all' })
}
