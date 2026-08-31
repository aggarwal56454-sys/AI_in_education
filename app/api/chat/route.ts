import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get('folderId');
  const persona = searchParams.get('persona');
  const sessionId = searchParams.get('sessionId');

  try {
    if (sessionId) {
      const messages = await prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
      return NextResponse.json(messages);
    }
    if (folderId && persona) {
      const sessions = await prisma.chatSession.findMany({ where: { folderId, persona }, orderBy: { createdAt: 'desc' } });
      return NextResponse.json(sessions);
    }
    return NextResponse.json([]);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  try {
    await prisma.chatSession.delete({ where: { id: sessionId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let { message, history, persona, folderId, sessionId } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
    if (!folderId) return NextResponse.json({ error: 'Missing Folder ID' }, { status: 400 });

    if (!sessionId || sessionId === 'new') {
      const newSession = await prisma.chatSession.create({
        data: { folderId, persona, title: message.substring(0, 30) + '...' }
      });
      sessionId = newSession.id;
    }

    await prisma.chatMessage.create({
      data: { sessionId, role: 'user', text: message }
    });

    const safeHistory: { role: string, parts: { text: string }[] }[] = [];
    let nextExpectedRole = 'user';
    for (const msg of history) {
      if (safeHistory.length === 0 && msg.role === 'model') continue;
      if (msg.role === nextExpectedRole) {
        safeHistory.push({ role: msg.role, parts: [{ text: msg.text }] });
        nextExpectedRole = nextExpectedRole === 'user' ? 'model' : 'user';
      }
    }

    const systemInstruction = persona === 'VM' 
      ? "You are VM, an AI mental health and motivation companion. Your user is balancing a first-year Economics Honours degree at Delhi University, an online internship, data analytics studies (Python/MySQL), and a 3-hour daily commute. STRICT RULE: You are NOT a tutor. If the user asks about academics, concepts, coding, or math, you MUST reply EXACTLY with: 'I am here for your mental well-being. For academic help, please proceed to the Pal tab for support.' Do not answer the academic question."
      : "You are Pal, an elite AI tutor. Your user is a first-year Economics Honours student at Delhi University learning data analytics. STRICT RULE: You are NOT a mental health expert. If the user expresses stress, burnout, emotional distress, or talks about their feelings, you MUST reply EXACTLY with: 'I am sorry to hear you are feeling this way. Please proceed to the VM tab for emotional support.' Do not give mental health advice.";

    if (safeHistory.length === 0) {
      safeHistory.push({ role: 'user', parts: [{ text: `[SYSTEM INSTRUCTIONS: ${systemInstruction}]\n\nUser: ${message}` }] });
    } else {
      safeHistory.push({ role: 'user', parts: [{ text: message }] });
    }

    const modelsReq = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const modelsData = await modelsReq.json();
    let targetModel = 'gemini-1.5-flash';
    if (modelsData.models) {
       const validFlash = modelsData.models.find((m: any) => m.name.includes('flash') && m.supportedGenerationMethods?.includes('generateContent'));
       targetModel = validFlash ? validFlash.name.replace('models/', '') : (modelsData.models.find((m: any) => m.supportedGenerationMethods?.includes('generateContent'))?.name.replace('models/', '') || targetModel);
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${targetModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: safeHistory })
    });

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't process that.";

    await prisma.chatMessage.create({
      data: { sessionId, role: 'model', text: reply }
    });
    
    return NextResponse.json({ reply, sessionId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
