import { NextRequest, NextResponse } from 'next/server';
import { explainStudentMistake } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const { question, correctAnswer, studentAnswer, concept } = await request.json();

    if (!question || !correctAnswer || !studentAnswer || !concept) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const explanation = await explainStudentMistake(
      question, 
      correctAnswer, 
      studentAnswer, 
      concept
    );
    
    return NextResponse.json(explanation);

  } catch (error) {
    console.error('Mistake API Error:', error);
    return NextResponse.json(
      { error: 'Failed to explain mistake. Please try again.' }, 
      { status: 500 }
    );
  }
}
