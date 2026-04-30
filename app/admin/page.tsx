"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ContentType = "news" | "knowledge";

interface FormState {
  type: ContentType;
  slug: string;
  title: string;
  summary: string;
  source: string;
  content: string;
  relatedKnowledge: string;
}

const INITIAL: FormState = {
  type: "news",
  slug: "",
  title: "",
  summary: "",
  source: "",
  content: "",
  relatedKnowledge: "",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d0d0d0",
  padding: "0.5rem 0.6rem",
  fontSize: "0.9rem",
  borderRadius: 3,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#444",
  marginBottom: "0.3rem",
};

const fieldStyle: React.CSSProperties = {
  marginBottom: "1.1rem",
};

export default function AdminPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  function set(key: keyof FormState, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/admin/login");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slug || !form.title) {
      setStatus("error");
      setMessage("슬러그와 제목은 필수입니다.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장 실패");
      setStatus("ok");
      setMessage(`저장 완료: ${data.path}`);
      setForm(INITIAL);
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "저장 중 오류가 발생했습니다.");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
        <h1 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
          콘텐츠 관리
        </h1>
        <button
          onClick={handleLogout}
          style={{
            fontSize: "0.8rem",
            color: "#888",
            background: "none",
            border: "1px solid #d0d0d0",
            padding: "0.3rem 0.7rem",
            borderRadius: 3,
            cursor: "pointer",
          }}
        >
          로그아웃
        </button>
      </div>

      {/* 타입 선택 */}
      <div
        style={{
          display: "flex",
          gap: "0",
          marginBottom: "1.75rem",
          border: "1px solid #d0d0d0",
          borderRadius: 3,
          overflow: "hidden",
          width: "fit-content",
        }}
      >
        {(["news", "knowledge"] as ContentType[]).map((t) => (
          <button
            key={t}
            onClick={() => set("type", t)}
            style={{
              padding: "0.45rem 1.1rem",
              fontSize: "0.875rem",
              fontWeight: form.type === t ? 700 : 400,
              background: form.type === t ? "#1a1a1a" : "#fff",
              color: form.type === t ? "#fff" : "#444",
              border: "none",
              cursor: "pointer",
            }}
          >
            {t === "news" ? "뉴스" : "지식"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
        <div style={fieldStyle}>
          <label style={labelStyle}>
            슬러그 <span style={{ color: "#999", fontWeight: 400 }}>(URL에 사용, 영문·숫자·하이픈 권장)</span>
          </label>
          <input
            style={inputStyle}
            value={form.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="e.g. openai-gpt5-release"
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>제목 *</label>
          <input
            style={inputStyle}
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="페이지 제목"
          />
        </div>

        {form.type === "news" && (
          <>
            <div style={fieldStyle}>
              <label style={labelStyle}>한 줄 요약</label>
              <input
                style={inputStyle}
                value={form.summary}
                onChange={(e) => set("summary", e.target.value)}
                placeholder="뉴스를 한 문장으로 요약"
              />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>원문 링크</label>
              <input
                style={inputStyle}
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                placeholder="https://..."
              />
            </div>
          </>
        )}

        <div style={fieldStyle}>
          <label style={labelStyle}>
            본문 <span style={{ color: "#999", fontWeight: 400 }}>(마크다운)</span>
          </label>
          <textarea
            style={{ ...inputStyle, minHeight: 240, resize: "vertical", lineHeight: 1.6 }}
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder={
              form.type === "news"
                ? "뉴스 배경 설명을 2~3문단으로 작성하세요..."
                : "개념 설명을 작성하세요..."
            }
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            관련 페이지 슬러그{" "}
            <span style={{ color: "#999", fontWeight: 400 }}>(쉼표로 구분)</span>
          </label>
          <input
            style={inputStyle}
            value={form.relatedKnowledge}
            onChange={(e) => set("relatedKnowledge", e.target.value)}
            placeholder="e.g. large-language-model, rag"
          />
        </div>

        {status !== "idle" && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.6rem 0.8rem",
              fontSize: "0.85rem",
              borderRadius: 3,
              background: status === "ok" ? "#f0fdf4" : status === "error" ? "#fef2f2" : "#f9f9f9",
              color: status === "ok" ? "#166534" : status === "error" ? "#991b1b" : "#555",
              border: `1px solid ${status === "ok" ? "#bbf7d0" : status === "error" ? "#fecaca" : "#e0e0e0"}`,
            }}
          >
            {status === "loading" ? "저장 중..." : message}
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          style={{
            padding: "0.55rem 1.5rem",
            background: "#1a1a1a",
            color: "#fff",
            border: "none",
            borderRadius: 3,
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: status === "loading" ? "not-allowed" : "pointer",
            opacity: status === "loading" ? 0.6 : 1,
          }}
        >
          저장
        </button>
      </form>
    </div>
  );
}
