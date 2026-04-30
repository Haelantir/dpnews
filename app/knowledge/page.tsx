import { getAllKnowledge } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function KnowledgeIndex() {
  const list = getAllKnowledge();

  return (
    <div>
      <h1
        style={{
          fontSize: "1.4rem",
          fontWeight: 800,
          marginBottom: "1.5rem",
          letterSpacing: "-0.02em",
        }}
      >
        지식 사전
      </h1>
      {list.length === 0 ? (
        <p style={{ color: "#999" }}>
          등록된 지식이 없습니다. <a href="/admin">관리 페이지</a>에서 추가해보세요.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {list.map((post) => (
            <li
              key={post.slug}
              style={{
                borderBottom: "1px solid #e0e0e0",
                padding: "0.75rem 0",
              }}
            >
              <a
                href={`/knowledge/${post.slug}`}
                style={{ fontWeight: 500, fontSize: "1rem", color: "#1a1a1a" }}
              >
                {post.title}
              </a>
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#999",
                  marginLeft: "0.75rem",
                }}
              >
                {post.date}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
