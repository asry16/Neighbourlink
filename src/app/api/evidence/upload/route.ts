import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Only JPEG, PNG, and WebP images are permitted.",
        },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: "File size exceeds 5MB limit.",
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Controlled filename with sanitization
    const ext = file.name.split(".").pop() || "jpg";
    const filename = `evid_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${filename}`;

    return NextResponse.json({
      success: true,
      data: {
        fileUrl: publicUrl,
        fileName: filename,
        mimeType: file.type,
        sizeBytes: file.size,
      },
    });
  } catch (error: any) {
    console.error("Evidence upload failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
