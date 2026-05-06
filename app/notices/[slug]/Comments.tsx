'use client'

import { useState, useEffect, useCallback } from 'react'

interface Comment {
  id: number
  nickname: string
  body: string
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).replace(/\. /g, '.').replace(/\.$/, '')
}

export default function Comments({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deletePw, setDeletePw] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`)
    if (res.ok) setComments(await res.json())
    setLoading(false)
  }, [slug])

  useEffect(() => { fetchComments() }, [fetchComments])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!nickname.trim() || !password || !body.trim()) {
      setError('닉네임, 비밀번호, 내용을 모두 입력해주세요.')
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, nickname, password, body }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? '오류가 발생했습니다.'); return }
    setNickname(''); setPassword(''); setBody('')
    setComments(prev => [...prev, data])
  }

  async function handleDelete() {
    if (!deletePw) { setDeleteError('비밀번호를 입력해주세요.'); return }
    setDeleting(true)
    const res = await fetch(`/api/comments/${deleteId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: deletePw }),
    })
    const data = await res.json()
    setDeleting(false)
    if (!res.ok) { setDeleteError(data.error ?? '오류가 발생했습니다.'); return }
    setComments(prev => prev.filter(c => c.id !== deleteId))
    setDeleteId(null); setDeletePw(''); setDeleteError('')
  }

  return (
    <section style={{ marginTop: 48, borderTop: '2px solid #111', paddingTop: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 20px' }}>
        댓글 {comments.length > 0 ? `(${comments.length})` : ''}
      </h2>

      {/* Comment list */}
      {loading ? (
        <p style={{ fontSize: 13, color: '#aaa' }}>불러오는 중...</p>
      ) : comments.length === 0 ? (
        <p style={{ fontSize: 13, color: '#aaa', marginBottom: 24 }}>첫 번째 댓글을 남겨보세요.</p>
      ) : (
        <div style={{ marginBottom: 28 }}>
          {comments.map(c => (
            <div key={c.id} style={{
              padding: '14px 0',
              borderBottom: '1px solid #eee',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{c.nickname}</span>
                  <span style={{ fontSize: 11, color: '#bbb' }}>{formatDate(c.created_at)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {c.body}
                </p>
              </div>
              <button
                onClick={() => { setDeleteId(c.id); setDeletePw(''); setDeleteError('') }}
                style={{
                  fontSize: 11, color: '#bbb', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '2px 4px', flexShrink: 0,
                }}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete modal */}
      {deleteId !== null && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 8, padding: 24, width: 300, maxWidth: '90vw',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
          }}>
            <p style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: '#111' }}>댓글 삭제</p>
            <input
              type="password"
              placeholder="비밀번호 입력"
              value={deletePw}
              onChange={e => setDeletePw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDelete()}
              style={inputStyle}
              autoFocus
            />
            {deleteError && <p style={{ fontSize: 12, color: '#e44', margin: '6px 0 0' }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={() => { setDeleteId(null); setDeletePw(''); setDeleteError('') }}
                style={{ ...btnStyle, background: '#f2f2f2', color: '#555', flex: 1 }}
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ ...btnStyle, background: '#111', color: '#fff', flex: 1 }}
              >
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write form */}
      <form onSubmit={handleSubmit} style={{ background: '#f9f9f9', borderRadius: 6, padding: '18px 16px' }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#333' }}>댓글 작성</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="닉네임"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            maxLength={20}
            style={{ ...inputStyle, flex: '1 1 120px', minWidth: 0 }}
          />
          <input
            type="password"
            placeholder="비밀번호 (삭제 시 사용)"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ ...inputStyle, flex: '2 1 180px', minWidth: 0 }}
          />
        </div>
        <textarea
          placeholder="댓글을 입력하세요 (최대 1000자)"
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={1000}
          rows={4}
          style={{
            ...inputStyle,
            width: '100%', resize: 'vertical', display: 'block',
            marginBottom: 8, boxSizing: 'border-box',
          }}
        />
        {error && <p style={{ fontSize: 12, color: '#e44', margin: '0 0 8px' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={submitting} style={{ ...btnStyle, background: '#111', color: '#fff', minWidth: 80 }}>
            {submitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </form>
    </section>
  )
}

const inputStyle: React.CSSProperties = {
  fontSize: 13,
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: 4,
  outline: 'none',
  fontFamily: 'inherit',
  color: '#333',
  background: '#fff',
}

const btnStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  padding: '8px 16px',
  borderRadius: 4,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
