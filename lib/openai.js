/**
 * OpenAI integration for AI-generated quiz questions.
 * Requires OPENAI_API_KEY in .env.
 */

const OpenAI = require('openai');

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

const VALID_TYPES = new Set(['multiple-choice', 'matching', 'drag-drop']);

function normalizeQuestionType(raw) {
  if (!raw || typeof raw !== 'string') return 'multiple-choice';
  const t = raw.trim().toLowerCase().replace(/_/g, '-');
  if (VALID_TYPES.has(t)) return t;
  if (t === 'multiplechoice' || t === 'mcq' || t === 'choice') return 'multiple-choice';
  if (t === 'match' || t === 'match-pairs') return 'matching';
  if (t === 'dragdrop' || t === 'drag' || t === 'ordering' || t === 'order') return 'drag-drop';
  return 'multiple-choice';
}

function extractQuestionsArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed.quiz_questions)) return parsed.quiz_questions;
    if (Array.isArray(parsed.items)) return parsed.items;
  }
  return null;
}

function parseQuestionsJson(content) {
  let jsonStr = content.trim();
  const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) jsonStr = codeMatch[1].trim();

  try {
    const parsed = JSON.parse(jsonStr);
    const arr = extractQuestionsArray(parsed);
    if (arr) return arr;
  } catch {
    /* try fallbacks below */
  }

  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* ignore */
    }
  }

  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      const parsed = JSON.parse(objectMatch[0]);
      const arr = extractQuestionsArray(parsed);
      if (arr) return arr;
    } catch {
      /* ignore */
    }
  }

  throw new Error('Could not parse quiz JSON from the model response');
}

/**
 * Ask OpenAI to generate quiz questions for a nursing competency.
 * @param {string} competencyName - Name of the competency
 * @param {string} [competencyDescription] - Optional description
 * @param {number} [count=3] - Number of questions to generate (1-5)
 * @returns {Promise<Array<{ question_text, question_type, options, correct_answer }>>}
 */
async function generateQuizQuestions(competencyName, competencyDescription = '', count = 3) {
  const client = getClient();
  if (!client) throw new Error('OPENAI_API_KEY is not set in .env');

  const n = Math.min(5, Math.max(1, count));

  const prompt = `You are creating quiz questions for nursing students. Generate exactly ${n} quiz questions for this clinical competency.

Competency: ${competencyName}
${competencyDescription ? `Description: ${competencyDescription}` : ''}

Return a single JSON object with a property "questions" whose value is an array of ${n} items. No markdown fences, no commentary—only valid JSON.

Each item must have:
- question_text: string (clear question)
- question_type: one of "multiple-choice", "matching", "drag-drop"
- options: for multiple-choice or drag-drop use an array of strings; for matching use object with "left" (array of terms) and "right" (array of definitions), same length
- correct_answer: for multiple-choice an array with one string (the correct option); for drag-drop the correct order as array of strings; for matching an object mapping each left term to its right definition string

Mix question types. Use proper nursing/clinical wording. Example shapes:
{"questions":[{"question_text":"...","question_type":"multiple-choice","options":["A","B","C","D"],"correct_answer":["B"]}]}

Matching example: options {"left":["Term1","Term2"],"right":["Def1","Def2"]}, correct_answer {"Term1":"Def1","Term2":"Def2"}
Drag-drop example: options ["Step1","Step2"], correct_answer ["Step1","Step2"]`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 4096,
    response_format: { type: 'json_object' }
  });

  const content = completion.choices[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty response from OpenAI');

  const questions = parseQuestionsJson(content);
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Model returned no quiz questions');
  }

  return questions.map(q => {
    const question_type = normalizeQuestionType(q.question_type);
    let options = q.options ?? [];
    let correct_answer = q.correct_answer;

    if (question_type === 'multiple-choice') {
      if (!Array.isArray(options)) options = [];
      if (!Array.isArray(correct_answer)) {
        correct_answer = options.length ? [String(options[0])] : [];
      }
    } else if (question_type === 'matching') {
      if (!options || typeof options !== 'object' || Array.isArray(options)) {
        options = { left: [], right: [] };
      }
      if (!options.left) options.left = [];
      if (!options.right) options.right = [];
      if (!correct_answer || typeof correct_answer !== 'object' || Array.isArray(correct_answer)) {
        correct_answer = {};
      }
    } else {
      if (!Array.isArray(options)) options = [];
      if (!Array.isArray(correct_answer)) {
        correct_answer = [...options];
      }
    }

    return {
      question_text: (q.question_text && String(q.question_text)) || '',
      question_type,
      options,
      correct_answer
    };
  });
}

module.exports = { getClient, generateQuizQuestions };
