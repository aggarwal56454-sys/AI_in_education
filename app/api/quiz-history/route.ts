import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId');
  if (!folderId) return NextResponse.json({ error: 'Missing folderId' }, { status: 400 });
  
  try {
    const history = await prisma.quizHistory.findMany({ 
      where: { folderId }, 
      orderBy: { createdAt: 'desc' } 
    });
    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { folderId, type, score, total, quizData } = await request.json();
    const newQuiz = await prisma.quizHistory.create({
      data: { folderId, type, score, total, quizData: JSON.stringify(quizData) }
    });
    return NextResponse.json(newQuiz);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save quiz' }, { status: 500 });
  }
}
