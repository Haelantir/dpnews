import { NextRequest, NextResponse } from "next/server";
import path from "path";
import matter from "gray-matter";

function buildMarkdown(
  type: "news" | "knowledge",
  fields: Record<string, string>
): string {
  const relatedKnowledge = fields.relatedKnowledge
    ? fields.relatedKnowledge
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const frontmatter: Record<string, unknown> = {
    title: fields.title,
    date: new Date().toISOString().slice(0, 10),
    relatedKnowledge,
  };

  if (type === "news") {
    frontmatter.summary = fields.summary ?? "";
    frontmatter.source = fields.source ?? "";
  }

  return matter.stringify(fields.content ?? "", frontmatter);
}

async function saveViaGitHub(
  filePath: string,
  content: string
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/repo"
  const branch = process.env.GITHUB_BRANCH ?? "main";

  if (!token || !repo) throw new Error("GitHub 환경변수가 설정되지 않았습니다.");

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  // 기존 파일이 있으면 sha 가져오기
  let sha: string | undefined;
  const getRes = await fetch(apiUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (getRes.ok) {
    const existing = await getRes.json();
    sha = existing.sha;
  }

  const body: Record<string, unknown> = {
    message: `content: add/update ${filePath}`,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const putRes = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub API 오류: ${err}`);
  }
}

async function saveLocally(
  filePath: string,
  content: string
): Promise<void> {
  const { writeFile, mkdir } = await import("fs/promises");
  const absPath = path.join(process.cwd(), filePath);
  await mkdir(path.dirname(absPath), { recursive: true });
  await writeFile(absPath, content, "utf-8");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, slug, ...fields } = body as {
      type: "news" | "knowledge";
      slug: string;
      [key: string]: string;
    };

    if (!type || !slug || !fields.title) {
      return NextResponse.json(
        { error: "type, slug, title은 필수입니다." },
        { status: 400 }
      );
    }

    const safeslug = slug.replace(/[^a-z0-9가-힣_-]/g, "-");
    const relPath = `content/${type}/${safeslug}.md`;
    const markdown = buildMarkdown(type, fields);

    const isVercel = !!process.env.VERCEL;

    if (isVercel) {
      await saveViaGitHub(relPath, markdown);
    } else {
      await saveLocally(relPath, markdown);
    }

    return NextResponse.json({ ok: true, path: relPath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
