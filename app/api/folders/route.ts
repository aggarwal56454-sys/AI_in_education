import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const folders = await prisma.folder.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ folders });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });

    const newFolder = await prisma.folder.create({
      data: { name }
    });
    return NextResponse.json(newFolder);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
