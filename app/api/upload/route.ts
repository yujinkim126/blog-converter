import { NextRequest, NextResponse } from "next/server";
import { uploadImageToGhost } from "@/lib/ghost";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "파일이 필요합니다" },
        { status: 400 }
      );
    }

    // File → Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ghost에 업로드
    const ghostImageUrl = await uploadImageToGhost(buffer, file.name);

    if (!ghostImageUrl) {
      return NextResponse.json(
        { error: "Ghost에서 이미지 URL을 받지 못했습니다" },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: ghostImageUrl });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err.message || "이미지 업로드 실패" },
      { status: 500 }
    );
  }
}
