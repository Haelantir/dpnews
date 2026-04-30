import { getAllNews, getAllKnowledge } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function Home() {
  const newsList = getAllNews();
  const knowledgeList = getAllKnowledge();

  return (
    <div>
      <section style={{ marginBottom: "3rem" }}>
        <h2
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#888",
            marginBottom: "1rem",
          }}
        >
          최신 뉴스
        </h2>
        {newsList.length === 0 ? (
          <p style={{ color: "#999", fontSize: "0.9rem" }}>
            등록된 뉴스가 없습니다.{" "}
            <a href="/admin">관리 페이지</a>에서 추가해보세요.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {newsList.map((post) => (
              <li
                key={post.slug}
                style={{
                  borderBottom: "1px solid #e0e0e0",
                  padding: "0.9rem 0",
                }}
              >
                <a
                  href={`/news/${post.slug}`}
                  style={{
                    fontWeight: 600,
                    fontSize: "1rem",
                    color: "#1a1a1a",
                    display: "block",
                    marginBottom: "0.2rem",
                  }}
                >
                  {post.title}
                </a>
                <p
                  style={{
                    color: "#555",
                    fontSize: "0.875rem",
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {post.summary}
                </p>
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "#999",
                    marginTop: "0.25rem",
                    display: "block",
                  }}
                >
                  {post.date}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#888",
            marginBottom: "1rem",
          }}
        >
          지식 사전
        </h2>
        {knowledgeList.length === 0 ? (
          <p style={{ color: "#999", fontSize: "0.9rem" }}>
            등록된 지식이 없습니다.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            {knowledgeList.map((post) => (
              <a
                key={post.slug}
                href={`/knowledge/${post.slug}`}
                style={{
                  fontSize: "0.875rem",
                  color: "#0057ad",
                  border: "1px solid #d0d0d0",
                  padding: "0.2rem 0.6rem",
                  borderRadius: 2,
                }}
              >
                {post.title}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
