"use client";

import { useMemo, useEffect, useState } from "react";

interface Segment {
  type: "heading" | "sentence";
  text: string;
  level?: number;
  num?: number;
}

function stripInline(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/~~(.*?)~~/g, "$1")
    .trim();
}

function parse(markdown: string): Segment[] {
  const out: Segment[] = [];
  let num = 1;

  for (const line of markdown.split("\n")) {
    const t = line.trim();
    if (!t) continue;

    // 마크다운 헤딩
    const h = t.match(/^(#{1,3})\s+(.+)/);
    if (h) {
      out.push({ type: "heading", text: h[2], level: h[1].length });
      continue;
    }

    // 인라인 마크다운 제거 후 문장 분리
    const plain = stripInline(t);
    if (!plain) continue;

    // " / " 를 경계로 문장 분리
    const sentences = plain
      .split(" / ")
      .map((s) => s.trim())
      .filter((s) => s.length > 1);

    for (const s of sentences) {
      out.push({ type: "sentence", text: s, num: num++ });
    }
  }

  return out;
}

function Circle({ n }: { n: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "1.65rem",
        height: "1.65rem",
        borderRadius: "50%",
        border: "1.5px solid #1a1a1a",
        fontSize: "0.7rem",
        fontWeight: 700,
        flexShrink: 0,
        color: "#1a1a1a",
        lineHeight: 1,
        marginTop: "0.08rem",
      }}
    >
      {n}
    </span>
  );
}

export function SentenceReader({ content }: { content: string }) {
  const segments = useMemo(() => parse(content), [content]);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    let i = 1;
    let timer: ReturnType<typeof setTimeout>;

    function next() {
      if (i > segments.length) return;
      setShown(i);
      i++;
      // 헤딩은 빠르게, 문장은 90ms 간격으로 순차 등장
      const delay = segments[i - 2]?.type === "heading" ? 50 : 90;
      timer = setTimeout(next, delay);
    }

    timer = setTimeout(next, 60);
    return () => clearTimeout(timer);
  }, [segments.length]);

  return (
    <div>
      {segments.map((seg, idx) => {
        const visible = idx < shown;
        const base: React.CSSProperties = {
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 0.35s ease, transform 0.35s ease",
        };

        if (seg.type === "heading") {
          return (
            <div
              key={idx}
              style={{
                ...base,
                fontWeight: 700,
                fontSize: seg.level === 1 ? "1.15rem" : "1rem",
                color: "#1a1a1a",
                marginTop: idx === 0 ? 0 : "1.75rem",
                marginBottom: "0.65rem",
                borderBottom:
                  seg.level === 2 ? "1px solid #e0e0e0" : "none",
                paddingBottom: seg.level === 2 ? "0.2rem" : 0,
              }}
            >
              {seg.text}
            </div>
          );
        }

        return (
          <div
            key={idx}
            style={{
              ...base,
              display: "flex",
              alignItems: "flex-start",
              gap: "0.7rem",
              marginBottom: "0.85rem",
            }}
          >
            <Circle n={seg.num!} />
            <span
              style={{
                lineHeight: 1.75,
                color: "#222",
                fontSize: "0.95rem",
              }}
            >
              {seg.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
