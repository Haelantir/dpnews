import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { client } from '@/lib/sanity.client'
import { noticesQuery } from '@/lib/sanity.queries'

export const revalidate = 60

export const metadata: Metadata = {
  title: '서울집주인 - 블로그',
  description: '서울집주인 공지사항 및 업데이트 소식을 확인하세요.',
  openGraph: { title: '서울집주인 - 블로그', description: '서울집주인 공지사항 및 업데이트 소식을 확인하세요.' },
}

interface Notice {
  _id: string
  title: string
  slug: { current: string }
  publishedAt: string
  excerpt?: string
  mainImage?: { asset: { url: string } }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function NoticesPage() {
  const notices: Notice[] = await client.fetch(noticesQuery)

  return (
    <div className="page-wrap">
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0, marginBottom: 6 }}>블로그</h1>
        <p style={{ fontSize: 13, color: '#999', margin: 0 }}>서울집주인의 소식을 전합니다.</p>
      </div>

      {notices.length === 0 ? (
        <p style={{ color: '#aaa', fontSize: 14 }}>아직 작성된 글이 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {notices.map((notice, i) => (
            <Link
              key={notice._id}
              href={`/notices/${notice.slug.current}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{
                padding: '20px 0',
                borderBottom: '1px solid #eee',
                borderTop: i === 0 ? '2px solid #111' : 'none',
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 600, color: '#111', lineHeight: 1.4 }}>
                      {notice.title}
                    </span>
                    <span style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {notice.publishedAt ? formatDate(notice.publishedAt) : ''}
                    </span>
                  </div>
                  {notice.excerpt && (
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: '#777', lineHeight: 1.6,
                      overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                      {notice.excerpt}
                    </p>
                  )}
                </div>
                {notice.mainImage?.asset?.url && (
                  <Image
                    src={notice.mainImage.asset.url}
                    alt={notice.title}
                    width={96}
                    height={72}
                    style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                  />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
