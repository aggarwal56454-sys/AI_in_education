import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file = data.get('file') as any;
    const docId = data.get('docId') as string;

    if (!file || !docId) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Save the PDF using the unique database ID as its filename
    const filePath = path.join(process.cwd(), 'public', 'uploads', `${docId}.pdf`);
    await writeFile(filePath, buffer);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
