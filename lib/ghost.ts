import { SignJWT } from "jose";

// ─── Ghost JWT Token 생성 ─────────────────────────────────
export async function getGhostToken(): Promise<string> {
  const apiKey = process.env.GHOST_ADMIN_API_KEY;
  if (!apiKey) throw new Error("GHOST_ADMIN_API_KEY 환경변수가 설정되지 않았습니다");

  const [id, secret] = apiKey.split(":");
  if (!id || !secret) throw new Error("API Key 형식이 올바르지 않습니다 (id:secret)");

  // hex string → Uint8Array
  const keyBytes = new Uint8Array(
    secret.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT", kid: id })
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience("/admin/")
    .sign(keyBytes);

  return token;
}

// ─── Ghost URL helper ─────────────────────────────────────
export function getGhostUrl(): string {
  const url = process.env.GHOST_URL;
  if (!url) throw new Error("GHOST_URL 환경변수가 설정되지 않았습니다");
  return url.replace(/\/+$/, ""); // trailing slash 제거
}

// ─── 이미지 업로드 ────────────────────────────────────────
export async function uploadImageToGhost(
  imageBuffer: Buffer,
  filename: string
): Promise<string> {
  const token = await getGhostToken();
  const ghostUrl = getGhostUrl();

  const formData = new FormData();
  const blob = new Blob([new Uint8Array(imageBuffer)], {
    type: getMimeType(filename),
  });
  formData.append("file", blob, filename);
  formData.append("purpose", "image");

  const res = await fetch(`${ghostUrl}/ghost/api/admin/images/upload/`, {
    method: "POST",
    headers: { Authorization: `Ghost ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`이미지 업로드 실패: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.images?.[0]?.url || "";
}

// ─── 포스트 생성 ──────────────────────────────────────────
export async function createGhostPost(params: {
  title: string;
  html: string;
  status: "draft" | "published";
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  tags?: string[];
}): Promise<{ success: boolean; postUrl?: string; error?: string }> {
  const token = await getGhostToken();
  const ghostUrl = getGhostUrl();

  const postPayload: Record<string, unknown> = {
    title: params.title,
    html: `<!--kg-card-begin: html-->${params.html}<!--kg-card-end: html-->`,
    status: params.status,
    meta_description: params.metaDescription || "",
    tags: (params.tags || [])
      .filter((t) => t.trim())
      .map((t) => ({ name: t.trim() })),
  };

  if (params.slug?.trim()) {
    postPayload.slug = params.slug.trim();
  }
  if (params.metaTitle?.trim()) {
    postPayload.meta_title = params.metaTitle.trim();
  }
  if (params.canonicalUrl?.trim()) {
    postPayload.canonical_url = params.canonicalUrl.trim();
  }

  const postBody = {
    posts: [postPayload],
  };

  const res = await fetch(`${ghostUrl}/ghost/api/admin/posts/?source=html`, {
    method: "POST",
    headers: {
      Authorization: `Ghost ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postBody),
  });

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `${res.status}: ${err}` };
  }

  const data = await res.json();
  const createdPost = data.posts?.[0];
  if (createdPost) {
    return { success: true, postUrl: createdPost.url || createdPost.slug };
  }
  return { success: false, error: "응답에 포스트 데이터가 없습니다" };
}

// ─── Helper ───────────────────────────────────────────────
function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return types[ext || ""] || "image/png";
}
