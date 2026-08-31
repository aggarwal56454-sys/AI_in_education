import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const folder = await prisma.folder.findUnique({
      where: { id },
      include: { 
        documents: {
          include: { concepts: true },
          orderBy: { createdAt: 'desc' }
        } 
      }
    });
    if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ folder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
