import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { PortableText } from '@portabletext/react'
import { client } from '@/lib/sanity.client'
import { noticeBySlugQuery, noticesQuery } from '@/lib/sanity.queries'
import Comments from './Comments'

export const revalidate = 60

interface Props { params: Promise<{ slug: string }> }

interface Notice {
  _id: string
  title: string
  slug: { current: string }
  publishedAt: string
  excerpt?: string
  mainImage?: { asset: { url: string; metadata: { dimensions: { width: number; height: number } } }; alt?: string }
  body?: any[]
}

export async function generateStaticParams() {
  const notices: { slug: { current: string } }[] = await client.fetch(noticesQuery)
  return notices.map(n => ({ slug: n.slug.current }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const notice: Notice = await client.fetch(noticeBySlugQuery, { slug })
  if (!notice) return { title: '서울집주인 - 블로그' }
  const title = `서울집주인 - ${notice.title}`
  return {
    title,
    description: notice.excerpt,
    openGraph: { title, description: notice.excerpt, images: notice.mainImage ? [notice.mainImage.asset.url] : [] },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

const portableComponents = {
  types: {
    image: ({ value }: any) => {
      if (!value?.asset?.url) return null
      const { width, height } = value.asset.metadata.dimensions
      return (
        <figure style={{ margin: '28px 0' }}>
          <Image
            src={value.asset.url}
            alt={value.alt ?? ''}
            width={width}
            height={height}
            style={{ width: '100%', height: 'auto', borderRadius: 4 }}
          />
          {value.caption && (
            <figcaption style={{ fontSize: 12, color: '#999', textAlign: 'center', marginTop: 8 }}>
              {value.caption}
            </figcaption>
          )}
        </figure>
      )
    },
  },
}

export default async function NoticePage({ params }: Props) {
  const { slug } = await params
  const notice: Notice = await client.fetch(noticeBySlugQuery, { slug })

  if (!notice) {
    return (
      <div className="page-wrap">
        <p style={{ color: '#aaa' }}>글을 찾을 수 없습니다.</p>
        <Link href="/blog" style={{ fontSize: 13, color: '#555' }}>← 블로그 목록</Link>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <Link href="/blog" style={{ fontSize: 13, color: '#888', textDecoration: 'none', display: 'inline-block', marginBottom: 24 }}>
        ← 블로그 목록
      </Link>

      <article>
        <header style={{ marginBottom: 32, paddingBottom: 20, borderBottom: '1px solid #eee' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111', margin: '0 0 10px', lineHeight: 1.4 }}>
            {notice.title}
          </h1>
          {notice.publishedAt && (
            <time style={{ fontSize: 13, color: '#aaa' }}>{formatDate(notice.publishedAt)}</time>
          )}
        </header>

        <div style={{
          fontSize: 15, lineHeight: 1.85, color: '#333',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {notice.body && <PortableText value={notice.body} components={portableComponents} />}
        </div>
      </article>

      <Comments slug={slug} />
    </div>
  )
}
