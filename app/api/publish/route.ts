import { NextRequest, NextResponse } from "next/server";
import { createGhostPost } from "@/lib/ghost";
import { blocksToFullHtml } from "@/lib/template";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, blocks, status, metaDescription, metaTitle, canonicalUrl, slug, tags } = body;

    if (!title || !blocks?.length) {
      return NextResponse.json(
        { error: "제목과 콘텐츠 블록이 필요합니다" },
        { status: 400 }
      );
    }

    // 블록 → HTML 변환
    const html = blocksToFullHtml(blocks);

    // Ghost에 발행
    const result = await createGhostPost({
      title,
      html,
      status: status === "published" ? "published" : "draft",
      metaDescription,
      metaTitle,
      canonicalUrl,
      slug,
      tags: tags || [],
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        postUrl: result.postUrl,
        message:
          status === "published"
            ? "발행 완료!"
            : "초안으로 저장되었습니다",
      });
    } else {
      return NextResponse.json(
        { error: result.error || "발행 실패" },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Publish error:", err);
    return NextResponse.json(
      { error: err.message || "서버 오류" },
      { status: 500 }
    );
  }
}
