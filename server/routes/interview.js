const express = require('express');
const { generationModel, analysisModel, generateJson, hasGemini } = require('../lib/gemini');

const router = express.Router();

const buildProfileContext = (p) => {
    if (!p) return 'Standard candidate.';
    const years = Number(p.experience) || 0;
    const seniority = years < 2 ? 'Fresher/Junior' : years < 5 ? 'Mid-level' : 'Senior';
    return `Candidate Name: ${p.name || 'Candidate'}
Target Role: ${p.targetRole || 'Not specified'}
Experience: ${years} years (Treat as ${seniority} level)
Industry: ${p.industry || 'General'}
English Proficiency: ${p.englishProficiency || 'Intermediate'}
Interview Type: ${p.interviewType || 'Behavioral'}`;
};

/** Clamps the requested question count to a sane range. */
const questionCount = (n) => Math.min(10, Math.max(3, Number(n) || 5));

/** 1. First question, tailored to the profile. */
router.post('/start-interview', async (req, res) => {
    const { profile } = req.body;
    const total = questionCount(profile?.questionCount);

    if (!hasGemini()) {
        return res.json({
            question: `Welcome, ${profile?.name || 'candidate'}. Tell me about your background and why you are interested in a ${profile?.targetRole || 'job'} role.`,
            totalQuestions: total,
        });
    }

    try {
        const prompt = `You are an expert ${profile?.interviewType || 'behavioral'} human interviewer for the ${profile?.industry || 'technology'} industry.
${buildProfileContext(profile)}

You are starting a ${total}-question interview. Write the FIRST question.

RULES:
- Never ask "tell me about yourself", "walk me through your resume", or "what are your strengths". Those waste the only question you get for free.
- Ask about something they would have actually done at their level. A fresher gets asked about a project, a course, or a thing they built; a senior gets asked about a decision, a trade-off, or a failure.
- One question, not three stacked together. Under 40 words.
- No preamble, no "Welcome". Just the question.
- Make it specific to ${profile?.targetRole || 'the role'} in ${profile?.industry || 'their industry'} — a question that would make no sense for a different role.

Respond ONLY with valid JSON:
{ "question": "..." }`;

        const parsed = await generateJson(generationModel, prompt);
        res.json({
            question: parsed.question || 'Could you start by telling me about yourself?',
            totalQuestions: total,
        });
    } catch (error) {
        console.error('Error starting interview:', error);
        res.status(502).json({ error: 'Failed to generate the first question. Please try again.' });
    }
});

/** 2. Reaction to the last answer plus the next question. */
router.post('/next-question', async (req, res) => {
    const { profile, history, currentAnswer, wpm, isVoice, fillerCount } = req.body;

    if (!Array.isArray(history)) {
        return res.status(400).json({ error: 'history must be an array of previous turns' });
    }
    if (!currentAnswer || !String(currentAnswer).trim()) {
        return res.status(400).json({ error: 'currentAnswer is required' });
    }

    const total = questionCount(profile?.questionCount);

    if (!hasGemini()) {
        return res.json({
            reaction: "That's an interesting point.",
            question: 'Let us move on. Describe a time you had to deal with a conflict.',
        });
    }

    try {
        const historyStr = history
            .map((turn, i) => `Turn ${i + 1}:\nQ: ${turn.q}\nA: ${turn.a}`)
            .join('\n\n');

        const voiceContext = isVoice
            ? `The candidate spoke this answer aloud. Speaking pace: ${wpm || 0} words per minute. Detected filler words: ${fillerCount ?? 'unknown'}. Treat this as transcribed speech.`
            : 'The candidate typed this answer on a keyboard. Evaluate accordingly.';

        const prompt = `You are a professional human interviewer conducting a sequential interview.
${buildProfileContext(profile)}

## Interview Progress So Far:
${historyStr || '(No previous history)'}

## The Current Interaction
You asked: "${history[history.length - 1]?.q || 'Unknown question'}"
The Candidate replied: "${currentAnswer}"

${voiceContext}

YOUR MISSION:
1. React in ONE sentence, the way a real interviewer does. Reference something concrete they actually said — a number, a tool, a decision. Never "Great answer!" or "Thanks for sharing". If the answer dodged the question or had no specifics, say so politely.
2. Ask the NEXT question (#${history.length + 1} of ${total}).

RULES FOR THE NEXT QUESTION:
- If their last answer made a claim without evidence ("I improved performance", "I led the team"), dig into that exact claim. How much? Measured how? What did you personally do?
- If they already answered well, move to a different competency rather than repeating one.
- Never re-ask something already covered in the transcript above.
- One question, under 40 words, no stacking.
- Raise the difficulty a notch each turn: turn 1-2 experience, middle turns judgement and trade-offs, final turns pressure — a failure, a conflict, or a thing they would do differently.

Respond ONLY with valid JSON:
{ "reaction": "<one sentence referencing what they said>", "question": "<the next question>" }`;

        const parsed = await generateJson(generationModel, prompt);
        res.json(parsed);
    } catch (error) {
        console.error('Error generating next question:', error);
        res.status(502).json({ error: 'Failed to generate the next question. Please try again.' });
    }
});

/** 3. Full-transcript analysis. */
router.post('/analyze-interview', async (req, res) => {
    const { profile, history } = req.body;

    if (!Array.isArray(history) || history.length === 0) {
        return res.status(400).json({ error: 'history must be a non-empty array' });
    }
    if (!hasGemini()) {
        return res.status(503).json({
            error: 'AI analysis is unavailable because GEMINI_API_KEY is not configured on the server.',
        });
    }

    try {
        const fullTranscript = history
            .map(
                (turn, i) =>
                    `## Turn ${i + 1}\nInterviewer Question: "${turn.q}"\nCandidate Answer (${
                        turn.mode === 'voice' ? `Voice — ${turn.wpm} WPM, ${turn.fillerCount ?? 0} fillers` : 'Text'
                    }): "${turn.a}"`
            )
            .join('\n\n');

        const prompt = `You are a master AI career coach and behavioral expert analyzing a completed job interview.
${buildProfileContext(profile)}

## Full Interview Transcript:
${fullTranscript}

YOUR MISSION:
Score this interview honestly and give feedback the candidate can act on tomorrow.

SCORING ANCHORS — use these so the numbers mean something:
- 90-100: would be hired on this answer alone. Specific, quantified, structured, no filler.
- 75-89: strong. Concrete examples with outcomes, minor structure or padding issues.
- 60-74: competent but generic. Real experience, no numbers or no clear personal contribution.
- 40-59: vague. Describes responsibilities rather than actions and results.
- 20-39: did not answer the question asked, or gave nothing checkable.
- 0-19: skipped, or a non-answer.
A skipped question scores 0 and must drag the overall score down.

Judge against their stated experience level: a fresher is not penalised for small scope, only for vagueness.
For voice answers, a normal pace is 120-150 WPM. Slow pace plus many filler words implies nervousness; rushed pace implies under-preparation.

Return ONLY valid JSON matching this schema:
{
  "overallScore": <0-100, consistent with the per-answer scores below>,
  "headline": "<max 8 words naming the single biggest thing to fix. e.g. 'Good stories, no numbers in them'>",
  "performanceSummary": "<3-4 sentences, mentor voice, referencing specific things they actually said>",
  "metrics": {
    "confidence": <0-100 from assertiveness, hedging, and voice hesitation>,
    "communicationClarity": <0-100 structure, brevity, whether the answer resolved>,
    "roleKnowledge": <0-100 domain depth relative to their experience level>,
    "fluency": <0-100 pace, filler words, run-on sentences>
  },
  "strengths": [<2-3 specific points, each quoting or naming something they actually said>],
  "weaknesses": [<2-3 specific points, each naming the exact answer it came from>],
  "improvements": [<2-3 concrete drills, not advice. "Rewrite your dashboard answer with a before/after number in the first sentence" beats "be more quantitative">],
  "behavioralInsight": "<brief observation on how they handled pressure and complexity>",
  "inferredSkills": [<3-6 concrete skills evidenced in the answers, for job matching>],
  "detailedQnA": [
    {
      "question": "<the original question>",
      "score": <0-100 using the anchors above>,
      "verdict": "<one sentence: what this specific answer did well or badly>",
      "missing": [<0-3 short phrases naming exactly what was absent: "no measurable outcome", "did not say what YOU did", "never answered the question asked". Empty array if the answer was strong>],
      "rewrite": "<THE MOST IMPORTANT FIELD. Take the candidate's OWN answer and rewrite it as they should have said it. Keep their actual project, their actual details, their actual situation — do not invent a different example or fabricate numbers they did not give. Where a number is missing, write a bracketed placeholder like [X%] so they can fill it in. 60-110 words, first person, spoken register. If they skipped the question, instead write a model answer for their profile and begin it with 'You skipped this. A usable answer would be:'>",
      "idealAnswer": "<one sentence naming the structural move a top candidate makes on this kind of question>"
    }
  ]
}

detailedQnA MUST contain one object for every question in the transcript, in order.`;

        const parsed = await generateJson(analysisModel, prompt);
        res.json(parsed);
    } catch (error) {
        console.error('Error running deep analysis:', error);
        res.status(502).json({
            error: 'Failed to analyse the interview. Please try again.',
            details: error.message,
        });
    }
});

/** 4. Extracts a structured profile from pasted resume text. */
router.post('/parse-resume', async (req, res) => {
    const { text } = req.body;

    if (!text || String(text).trim().length < 60) {
        return res.status(400).json({
            error: 'Resume text is too short. Paste the full resume or upload a PDF.',
        });
    }
    if (!hasGemini()) {
        return res.status(503).json({ error: 'Resume parsing requires GEMINI_API_KEY on the server.' });
    }

    try {
        const prompt = `Extract a structured candidate profile from this resume.

RESUME:
"""
${String(text).slice(0, 16000)}
"""

Return ONLY valid JSON:
{
  "name": "<candidate name, or empty string>",
  "targetRole": "<the single most likely role they are applying for>",
  "experience": <total years of professional experience as a number>,
  "industry": "<primary industry>",
  "skills": [<up to 10 concrete technical or professional skills>],
  "seniority": "<Fresher | Junior | Mid-level | Senior>",
  "searchQuery": "<a 2-5 word job-board search string that would surface the best matches>",
  "summary": "<two sentences describing this candidate>"
}

If the text is clearly not a resume, set targetRole to "" and explain in summary.`;

        const parsed = await generateJson(analysisModel, prompt);
        res.json(parsed);
    } catch (error) {
        console.error('Error parsing resume:', error);
        res.status(502).json({ error: 'Failed to parse the resume. Please try again.' });
    }
});

module.exports = router;
module.exports.buildProfileContext = buildProfileContext;
