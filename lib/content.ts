import fs from "fs";
import path from "path";
import matter from "gray-matter";

const contentDir = path.join(process.cwd(), "content");

export interface NewsPost {
  slug: string;
  title: string;
  summary: string;
  source: string;
  date: string;
  relatedKnowledge: string[];
  content: string;
}

export interface KnowledgePost {
  slug: string;
  title: string;
  date: string;
  relatedKnowledge: string[];
  content: string;
}

function getSlugs(type: "news" | "knowledge"): string[] {
  const dir = path.join(contentDir, type);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function getNewsPost(slug: string): NewsPost | null {
  const filePath = path.join(contentDir, "news", `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title ?? "",
    summary: data.summary ?? "",
    source: data.source ?? "",
    date: data.date ?? "",
    relatedKnowledge: data.relatedKnowledge ?? [],
    content,
  };
}

export function getKnowledgePost(slug: string): KnowledgePost | null {
  const filePath = path.join(contentDir, "knowledge", `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title ?? "",
    date: data.date ?? "",
    relatedKnowledge: data.relatedKnowledge ?? [],
    content,
  };
}

export function getAllNews(): NewsPost[] {
  return getSlugs("news")
    .map((slug) => getNewsPost(slug))
    .filter(Boolean)
    .sort((a, b) => (a!.date > b!.date ? -1 : 1)) as NewsPost[];
}

export function getAllKnowledge(): KnowledgePost[] {
  return getSlugs("knowledge")
    .map((slug) => getKnowledgePost(slug))
    .filter(Boolean)
    .sort((a, b) => (a!.date > b!.date ? -1 : 1)) as KnowledgePost[];
}
