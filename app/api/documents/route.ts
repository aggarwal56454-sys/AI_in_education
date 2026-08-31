import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

async function getCitations(query: string) {
  try {
    const res = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=2&fields=title,url,year`);
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      return data.data.map((p: any) => `[${p.year || 'N/A'}] ${p.title} (${p.url || '#'})`).join(' || ');
    }
    return 'No verified citations found.';
  } catch (e) { return 'Citation fetch failed.'; }
}

export async function POST(request: NextRequest) {
  try {
    const { folderId, title, content, pdfBase64, audioBase64, audioMimeType, language } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!folderId || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const document = await prisma.document.create({
      data: { folderId, title, content: content || (audioBase64 ? "Processed via Native Audio File" : "Processed via PDF") }
    });

    if (!apiKey) return NextResponse.json(document);

    try {
      const modelsReq = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const modelsData = await modelsReq.json();
      let targetModel = '';
      if (modelsData.models) {
         const validModels = modelsData.models.filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'));
         const bestModel = validModels.find((m: any) => m.name.includes('flash')) || validModels[0];
         if (bestModel) targetModel = bestModel.name.replace('models/', '');
      }

      const langInstruction = language && language !== 'Auto-Detect'
        ? `IMPORTANT: You MUST translate and write your extracted concepts and summaries strictly in ${language}.`
        : `IMPORTANT: Detect the language of the source file. You MUST write your extracted concepts in that EXACT SAME LANGUAGE.`;

      const prompt = `Analyze this material and extract 3 to 6 core educational concepts. ${langInstruction}
For each concept, evaluate its cognitive depth and requirements:
1. "name": Concept title
2. "summary": Clear, high-yield explanation
3. "bloomLevel": Choose the best fit from ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]
4. "prerequisites": 1-2 prerequisite topics needed to understand this (as a comma-separated string)

Return ONLY a valid JSON array of objects. Schema:
[{"name": "Concept", "summary": "Explanation", "bloomLevel": "Analyze", "prerequisites": "Prereq 1, Prereq 2"}]
Do not include markdown ticks.`;
      
      let parts: any[] = [];
      if (audioBase64) parts = [{ inlineData: { mimeType: audioMimeType || "audio/webm", data: audioBase64 } }, { text: prompt }];
      else if (pdfBase64) parts = [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }, { text: prompt }];
      else if (content) parts = [{ text: prompt + `\n\nText: ${content.substring(0, 15000)}` }];

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      });

      const data = await response.json();
      let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        const concepts = JSON.parse(match[0]);
        for (const concept of concepts) {
          if (concept.name && concept.summary) {
            const bloom = concept.bloomLevel || 'Understand';
            const prereqs = concept.prerequisites || '';
            const citations = await getCitations(concept.name);
            
            const combinedSummary = `${concept.summary}__META__${bloom}__META__${prereqs}__META__${citations}`;
            await prisma.concept.create({ data: { name: concept.name, summary: combinedSummary, documentId: document.id } });
          }
        }
      }
    } catch (aiError: any) { console.error(aiError); }
    
    return NextResponse.json(document);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
