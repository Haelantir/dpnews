import { getNewsPost, getKnowledgePost, getAllNews } from "@/lib/content";
import { SentenceReader } from "@/components/SentenceReader";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const posts = getAllNews();
  return posts.map((p) => ({ slug: p.slug }));
}

export default async function NewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getNewsPost(slug);
  if (!post) notFound();

  const relatedPosts = post.relatedKnowledge
    .map((s) => getKnowledgePost(s))
    .filter(Boolean);

  return (
    <article>
      <div
        style={{
          fontSize: "0.75rem",
          color: "#888",
          marginBottom: "0.5rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        뉴스 · {post.date}
      </div>

      <h1
        style={{
          fontSize: "1.6rem",
          fontWeight: 800,
          lineHeight: 1.3,
          letterSpacing: "-0.02em",
          marginBottom: "1rem",
          color: "#1a1a1a",
        }}
      >
        {post.title}
      </h1>

      {/* 한 줄 요약 */}
      <div
        style={{
          borderLeft: "3px solid #1a1a1a",
          paddingLeft: "0.875rem",
          marginBottom: "1.5rem",
          fontSize: "0.95rem",
          fontWeight: 500,
          color: "#333",
          lineHeight: 1.6,
        }}
      >
        {post.summary}
      </div>

      {/* 원문 링크 */}
      {post.source && (
        <div style={{ marginBottom: "2rem", fontSize: "0.8rem" }}>
          출처:{" "}
          <a
            href={post.source}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#0057ad" }}
          >
            {post.source}
          </a>
        </div>
      )}

      <hr
        style={{
          border: "none",
          borderTop: "1px solid #e0e0e0",
          marginBottom: "1.75rem",
        }}
      />

      {/* 본문 — 문장 단위로 순차 등장 */}
      <SentenceReader content={post.content} />

      {/* 관련 지식 */}
      {relatedPosts.length > 0 && (
        <div
          style={{
            marginTop: "3rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid #e0e0e0",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#888",
              marginBottom: "0.75rem",
            }}
          >
            관련 지식
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {relatedPosts.map((k) => (
              <a
                key={k!.slug}
                href={`/knowledge/${k!.slug}`}
                style={{
                  fontSize: "0.875rem",
                  color: "#0057ad",
                  border: "1px solid #d0d0d0",
                  padding: "0.3rem 0.75rem",
                  borderRadius: 2,
                  display: "block",
                  width: "fit-content",
                }}
              >
                {k!.title}
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: "2rem", fontSize: "0.85rem" }}>
        <a href="/" style={{ color: "#888" }}>← 목록으로</a>
      </div>
    </article>
  );
}
