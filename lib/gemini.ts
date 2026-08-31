import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});
const MODEL_NAME = 'gemini-2.5-flash';

export async function analyzeMaterialContent(content: string) {
  const prompt = `
You are an expert AI tutor. Analyze the following educational material. 
Extract exactly 3 to 4 core concepts taught in the text. 
For each concept, provide a clear name and a concise summary.

Material:
"""
${content}
"""

Return the response strictly as a JSON object matching this schema:
{
  "concepts": [
    {
      "name": "Concept Name",
      "summary": "Clear, 2-sentence explanation of the concept."
    }
  ]
}
`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    throw new Error('Failed to analyze material.');
  }
}

export async function generateQuizForConcept(conceptName: string, conceptSummary: string) {
  const prompt = `
You are an expert examiner. Generate 3 active-recall multiple-choice questions to test a student's understanding of this specific concept:
Concept: ${conceptName}
Summary: ${conceptSummary}

Return the response strictly as a JSON object matching this schema:
{
  "questions": [
    {
      "questionText": "The actual question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Exact matching string of the correct option",
      "explanation": "Pedagogical explanation of why this answer is correct."
    }
  ]
}
`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Gemini Quiz Error:', error);
    throw new Error('Failed to generate quiz.');
  }
}

export async function explainStudentMistake(
  question: string,
  correctAnswer: string,
  studentAnswer: string,
  concept: string
) {
  const prompt = `
An educational AI tutor is diagnosing a student error to improve their active learning.
Concept: ${concept}
Question: ${question}
Correct Answer: ${correctAnswer}
Student's Wrong Answer: ${studentAnswer}

Provide a pedagogical explanation addressing:
1. attemptAnalysis: What the student likely attempted or where their logic deviated.
2. correctReasoning: The correct reasoning path clearly explained.

Return the response strictly as a JSON object matching this schema:
{
  "attemptAnalysis": "...",
  "correctReasoning": "..."
}
`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });
    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error('Gemini Mistake Error:', error);
    throw new Error('Failed to explain mistake.');
  }
}
