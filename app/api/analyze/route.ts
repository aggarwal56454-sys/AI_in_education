import { NextRequest, NextResponse } from 'next/server';
import { analyzeMaterialContent } from '@/lib/gemini';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { content, folderId } = await request.json();
    if (!content || !folderId) return NextResponse.json({ error: 'Content and folderId required' }, { status: 400 });

    const analysis = await analyzeMaterialContent(content);
    
    // 1. Save the raw text as a Document inside the Folder
    const document = await prisma.document.create({
      data: {
        title: 'Pasted Material - ' + new Date().toLocaleDateString(),
        content: content,
        folderId: folderId
      }
    });

    // 2. Save the flashcards and link them to the Document
    const savedConcepts = await prisma.$transaction(
      analysis.concepts.map((concept: {name: string, summary: string}) => 
        prisma.concept.create({
          data: {
            name: concept.name,
            summary: concept.summary,
            documentId: document.id
          }
        })
      )
    );

    return NextResponse.json({ concepts: savedConcepts });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to analyze material.' }, { status: 500 });
  }
}
