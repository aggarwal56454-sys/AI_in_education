import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { folderId, type = 'mcq', count = 3, language, documentId, conceptId, customConcepts } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!folderId || !apiKey) return NextResponse.json({ error: 'Missing data' }, { status: 400 });

    let conceptsToTest = [];
    if (customConcepts && customConcepts.length > 0) {
      conceptsToTest = await prisma.concept.findMany({ where: { id: { in: customConcepts } } });
    } else {
      let whereClause: any = { document: { folderId } };
      if (conceptId && conceptId !== 'all') {
        whereClause = { id: conceptId };
      } else if (documentId && documentId !== 'all') {
        whereClause = { documentId: documentId };
      }
      conceptsToTest = await prisma.concept.findMany({ where: whereClause });
    }

    if (conceptsToTest.length === 0) return NextResponse.json({ questions: [] });
    
    const conceptText = conceptsToTest.map((c: any) => `ID: ${c.id} | Name: ${c.name} | Summary: ${c.summary.split('__META__')[0]}`).join('\n');
    
    const modelsReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const modelsData = await modelsReq.json();
    let targetModel = 'gemini-1.5-flash-latest';
    if (modelsData.models) {
       const validModels = modelsData.models.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'));
       const bestModel = validModels.find((m: any) => m.name.includes('flash')) || validModels[0];
       if (bestModel) targetModel = bestModel.name.replace('models/', '');
    }

    const langRule = language && language !== 'Auto-Detect'
      ? `IMPORTANT: You MUST write all questions, options, answers, and explanations strictly in ${language}. Translate if necessary.`
      : `IMPORTANT: Detect the language of the provided concepts. Write all questions, options, answers, and explanations in that EXACT SAME LANGUAGE.`;

    let prompt = "";
    if (type === 'mcq') {
       prompt = `Create a ${count}-question multiple choice quiz testing these concepts: \n${conceptText}\n\n${langRule} Return ONLY a JSON array. Schema: [{"conceptId": "ID of concept tested", "question": "...", "options": ["A", "B", "C", "D"], "answer": "Exact correct option", "explanation": "Why"}]. Do not include markdown ticks.`;
    } else {
       prompt = `Create a ${count}-question ${type} answer test testing these concepts: \n${conceptText}\n\n${langRule} Return ONLY a JSON array. Schema: [{"conceptId": "ID of concept tested", "question": "...", "answer": "Ideal detailed answer", "explanation": "Key grading points"}]. Do not include markdown ticks.`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const match = rawText.match(/\[[\s\S]*\]/);
    return NextResponse.json({ questions: match ? JSON.parse(match[0]) : [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
