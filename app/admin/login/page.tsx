"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #d0d0d0",
  padding: "0.55rem 0.7rem",
  fontSize: "0.95rem",
  borderRadius: 3,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "로그인 실패");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 320,
        margin: "4rem auto",
        padding: "2rem",
        border: "1px solid #e0e0e0",
        borderRadius: 4,
      }}
    >
      <h1
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          marginBottom: "1.5rem",
          color: "#1a1a1a",
        }}
      >
        관리자 로그인
      </h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "0.9rem" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#444",
              marginBottom: "0.3rem",
            }}
          >
            아이디
          </label>
          <input
            style={inputStyle}
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div style={{ marginBottom: "1.2rem" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#444",
              marginBottom: "0.3rem",
            }}
          >
            비밀번호
          </label>
          <input
            style={inputStyle}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && (
          <div
            style={{
              marginBottom: "1rem",
              fontSize: "0.85rem",
              color: "#991b1b",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              padding: "0.5rem 0.7rem",
              borderRadius: 3,
            }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.6rem",
            background: "#1a1a1a",
            color: "#fff",
            border: "none",
            borderRadius: 3,
            fontSize: "0.9rem",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "로그인 중..." : "로그인"}
        </button>
      </form>
    </div>
  );
}
