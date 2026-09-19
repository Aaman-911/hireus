require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// Initialize Gemini AI
let genAI;
let generationModel;
let analysisModel;

try {
  if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-2.5-flash for broader compatibility
    generationModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    analysisModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    console.log("Google Gemini AI client initialized successfully.");
  } else {
    console.warn("GEMINI_API_KEY not found in .env file. Falling back to mock responses.");
  }
} catch (error) {
  console.error("Failed to initialize Google Gemini AI:", error);
}

// Retry on Gemini 429 (free-tier rate limit), honoring suggested retry delay
const generateWithRetry = async (model, prompt, retries = 3) => {
    for (let attempt = 0; ; attempt++) {
        try {
            return await model.generateContent(prompt);
        } catch (error) {
            if (error.status !== 429 || attempt >= retries) throw error;
            const match = /retry in ([\d.]+)s/i.exec(error.message || '');
            const waitMs = (match ? parseFloat(match[1]) + 1 : 15) * 1000;
            console.warn(`Gemini 429, retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${retries})`);
            await new Promise(r => setTimeout(r, waitMs));
        }
    }
};

// Helper to build a context string from a user profile
const buildProfileContext = (p) => {
    if (!p) return "Standard candidate.";
    return `Candidate Name: ${p.name || 'Candidate'}
Target Role: ${p.targetRole || 'Not specified'}
Experience: ${p.experience || 0} years (Treat as ${p.experience < 2 ? 'Fresher/Junior' : p.experience < 5 ? 'Mid-level' : 'Senior'} level)
Industry: ${p.industry || 'General'}
English Proficiency: ${p.englishProficiency || 'Intermediate'}
Interview Type: ${p.interviewType || 'Behavioral'}`;
};

/**
 * 1. START INTERVIEW: Generates the specialized first question based on deep profile.
 */
app.post('/start-interview', async (req, res) => {
    const { profile } = req.body;

    if (!generationModel) {
        return res.json({
            question: `Welcome, ${profile?.name || 'candidate'}. Please tell me about your background and why you are interested in a ${profile?.targetRole || 'job'} role?`
        });
    }

    try {
        const contextStr = buildProfileContext(profile);
        const prompt = `You are an expert ${profile?.interviewType || 'behavioral'} human interviewer for the ${profile?.industry || 'technology'} industry.
${contextStr}

Your goal is to start a 5-question interview. 
Generate the highly tailored FIRST question for this candidate to break the ice but test relevant skills based on their experience level. DO NOT write an intro like "Welcome", just write the interview question. Ensure it adapts to their exact experience (Fresher questions should be wildly different than Senior questions).

Respond ONLY with a valid JSON format like this:
{
  "question": "..."
}
Do not include markdown blocks like \`\`\`json. Just output the raw JSON string.`;

        const result = await generateWithRetry(generationModel, prompt);
        let responseText = result.response.text();
        
        const cleanJson = responseText.replace(/```json\n|\n```|```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        
        res.json({ question: parsed.question || "Could you start by telling me about yourself?" });
    } catch (error) {
        console.error("Error starting interview:", error);
        res.status(500).json({ error: "Failed to generate initial question" });
    }
});

/**
 * 2. NEXT QUESTION: Evaluates the specific answer, provides a brief human-like feedback/reaction, and asks the next question based on chat history.
 */
app.post('/next-question', async (req, res) => {
    const { profile, history, currentAnswer, wpm, isVoice } = req.body;

    // history should look like: [{q: "...", a: "..."}, {q: "...", a: "..."}]

    if (!generationModel) {
        return res.json({
            reaction: "That's an interesting point.",
            question: "Let's move on. Describe a time you had to deal with a conflict."
        });
    }

    try {
        const contextStr = buildProfileContext(profile);
        const historyStr = history.map((turn, i) => `Turn ${i+1}:\nQ: ${turn.q}\nA: ${turn.a}`).join("\n\n");
        const voiceContext = isVoice 
            ? `The candidate spoke this answer aloud. The calculated speaking pace is ${wpm || 0} Words Per Minute. Treat this as transcribed speech.`
            : `The candidate typed this answer on a keyboard. Evaluate accordingly.`;

        const prompt = `You are a professional human interviewer conducting a sequential interview.
${contextStr}

## Interview Progress So Far:
${historyStr || "(No previous history)"}

## The Current Interaction
You asked: "${history[history.length - 1]?.q || 'Unknown question'}"
The Candidate replied: "${currentAnswer}"

${voiceContext}

YOUR MISSION:
1. Briefly react to the candidate's latest answer like a real human interviewer (e.g., "Good example," or "I see, but what about...", "Interesting."). Be constructive, encouraging, but probe if the answer was weak. Keep the reaction to 1-2 sentences.
2. Formulate the NEXT question (Question #${history.length + 1} of 5). The next question should logically follow the conversation (can be a deep follow-up to their answer, or pivot to the next topic). Increase difficulty slightly.

Respond ONLY with a valid JSON object:
{
  "reaction": "<Human-like brief conversational response>",
  "question": "<The next interview question>"
}`;

        const result = await generateWithRetry(generationModel, prompt);
        const cleanJson = result.response.text().replace(/```json\n|\n```|```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        
        res.json(parsed);
    } catch (error) {
        console.error("Error generating next question:", error);
        res.status(500).json({ error: "Failed to process next turn" });
    }
});

/**
 * 3. ANALYZE INTERVIEW: Post-interview deep dive across the entire 5-question transcript.
 */
app.post('/analyze-interview', async (req, res) => {
    const { profile, history } = req.body;

    if (!analysisModel || !history || history.length === 0) {
        return res.status(500).json({ error: "No AI model initialized or empty history" });
    }

    try {
        const contextStr = buildProfileContext(profile);
        const fullTranscript = history.map((turn, i) => 
            `## Turn ${i+1}\nExpert Interviewer Question: "${turn.q}"\nCandidate Answer (${turn.mode === 'voice' ? `Voice - ${turn.wpm}WPM` : 'Text'}): "${turn.a}"`
        ).join("\n\n");

        const prompt = `You are a master AI career coach and behavioral expert analyzing a completed job interview.
${contextStr}

## Full Interview Transcript:
${fullTranscript}

YOUR MISSION:
Perform a deep, multifaceted evaluation of the candidate's entire performance.
- Evaluate textual grammar/structure for typed answers.
- Evaluate fluency, filler word presence, hesitations, and pacing (Words Per Minute) for voice answers. A normal speaking pace is 120-150 WPM. Slow pacing with filler words implies nervousness.
- Base expectations severely on their experience level.

Return ONLY a valid JSON object matching this schema. Do not output markdown blocks.
{
  "overallScore": <Number 0-100: Total weighted performance score>,
  "performanceSummary": "<String: 3-4 sentence comprehensive feedback paragraph acting as a mentor>",
  "metrics": {
    "confidence": <Number 0-100: inferred aggressively from voice hesitation or text assertiveness>,
    "communicationClarity": <Number 0-100: brevity, grammar, structure>,
    "roleKnowledge": <Number 0-100: technical/domain depth relative to experience level>,
    "fluency": <Number 0-100: speaking pace, filler words, stuttering issues>
  },
  "strengths": [<Array of strings: 2 to 3 specific strong points>],
  "weaknesses": [<Array of strings: 2 to 3 areas holding them back>],
  "improvements": [<Array of strings: 2 to 3 highly actionable suggestions to practice>],
  "behavioralInsight": "<String: Brief psychological observation on how the candidate handled stress/complexity>",
  "detailedQnA": [
      {
          "question": "Original question 1",
          "idealAnswer": "How a 10/10 expert candidate would have ideally answered this succinctly"
      }
      // Provide an object for each question asked in the history
  ]
}`;

        const result = await generateWithRetry(analysisModel, prompt);
        const cleanJson = result.response.text().replace(/```json\n|\n```|```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        
        res.json(parsed);
    } catch (error) {
        console.error("Error running deep analysis:", error);
        res.status(500).json({ error: "Failed to perform AI final analysis", details: error.message });
    }
});

/**
 * 4. JOB RECOMMENDATIONS: Fetches real job listings from Adzuna, refined and ranked by AI.
 */
app.get('/job-recommendations', async (req, res) => {
    const { targetRole, experience, industry, skills, score } = req.query;

    if (!targetRole) {
        return res.status(400).json({ error: "targetRole query parameter is required" });
    }

    const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
    const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
    const ADZUNA_COUNTRY = process.env.ADZUNA_COUNTRY || 'in';

    if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY || ADZUNA_APP_ID === 'your_app_id_here') {
        return res.status(500).json({ error: "Adzuna API credentials not configured. Please add ADZUNA_APP_ID and ADZUNA_APP_KEY to server/.env" });
    }

    try {
        // --- STAGE 1: Use Gemini to build an optimized search query ---
        let searchQuery = targetRole;

        if (generationModel) {
            try {
                const refinePrompt = `You are a job search optimization expert. Based on the following candidate profile, generate a SINGLE concise job search query string (2-5 words max) that would return the most relevant job listings on a job board.

Candidate Profile:
- Target Role: ${targetRole}
- Experience: ${experience || 'Not specified'} years
- Industry: ${industry || 'Not specified'}
- Key Skills: ${skills || 'Not specified'}
- Interview Score: ${score || 'Not specified'}/100

Rules:
- Return ONLY the search query string, nothing else. No quotes, no explanation.
- Focus on the target role but adjust based on experience level (e.g., "Junior" for <2 years, "Senior" for 5+ years).
- Keep it short and focused for best API results.`;

                const result = await generateWithRetry(generationModel, refinePrompt);
                const refinedQuery = result.response.text().trim();
                if (refinedQuery && refinedQuery.length < 100) {
                    searchQuery = refinedQuery;
                }
            } catch (aiError) {
                console.warn("Gemini query refinement failed, using raw targetRole:", aiError.message);
            }
        }

        console.log(`[Job Recommendations] Searching Adzuna for: "${searchQuery}"`);

        // --- STAGE 2: Fetch jobs from Adzuna API ---
        const adzunaUrl = `https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/1`;
        const adzunaResponse = await axios.get(adzunaUrl, {
            params: {
                app_id: ADZUNA_APP_ID,
                app_key: ADZUNA_APP_KEY,
                results_per_page: 10,
                what: searchQuery
            },
            timeout: 10000
        });

        const rawJobs = adzunaResponse.data?.results || [];

        if (rawJobs.length === 0) {
            return res.json({ jobs: [], message: "No jobs found matching your profile. Try broadening your search." });
        }

        // Map Adzuna results into a clean format
        const jobCandidates = rawJobs.map((job, index) => ({
            id: index,
            title: job.title || 'Untitled Position',
            company: job.company?.display_name || 'Company Not Listed',
            location: job.location?.display_name || 'Location Not Specified',
            description: (job.description || '').substring(0, 300),
            applyLink: job.redirect_url || '#',
            salary: job.salary_is_predicted ? `~${Math.round(job.salary_min || 0).toLocaleString()} - ${Math.round(job.salary_max || 0).toLocaleString()}` : null,
            created: job.created
        }));

        // --- STAGE 3: Use Gemini to rank jobs by relevance ---
        let rankedJobs = jobCandidates.slice(0, 5); // Default: top 5 without ranking

        if (analysisModel) {
            try {
                const jobListStr = jobCandidates.map((j, i) => 
                    `[${i}] "${j.title}" at ${j.company} (${j.location}) — ${j.description.substring(0, 150)}...`
                ).join('\n');

                const rankPrompt = `You are a career matching expert. Rank the following jobs by relevance to this candidate and assign a match score (0-100) to each.

CANDIDATE:
- Target Role: ${targetRole}
- Experience: ${experience || 'Not specified'} years
- Industry: ${industry || 'Not specified'}
- Key Skills: ${skills || 'Not specified'}
- Interview Performance: ${score || 'Not specified'}/100

JOBS:
${jobListStr}

Return ONLY a valid JSON array of the TOP 5 most relevant jobs (sorted best first), each with:
{
  "id": <original index number>,
  "matchScore": <0-100 relevance score>,
  "reason": "<one-line reason for match>"
}

Do not include markdown blocks. Just raw JSON array.`;

                const result = await generateWithRetry(analysisModel, rankPrompt);
                const cleanJson = result.response.text().replace(/```json\n|\n```|```/g, "").trim();
                const rankings = JSON.parse(cleanJson);

                // Merge rankings with job data
                rankedJobs = rankings
                    .filter(r => r.id !== undefined && jobCandidates[r.id])
                    .map(r => ({
                        ...jobCandidates[r.id],
                        matchScore: Math.min(100, Math.max(0, r.matchScore || 50)),
                        matchReason: r.reason || ''
                    }))
                    .slice(0, 5);

            } catch (aiError) {
                console.warn("Gemini ranking failed, returning unranked results:", aiError.message);
                // Add default scores for unranked results
                rankedJobs = rankedJobs.map((j, i) => ({
                    ...j,
                    matchScore: Math.max(50, 85 - (i * 8)),
                    matchReason: ''
                }));
            }
        } else {
            // No AI available — assign descending default scores
            rankedJobs = rankedJobs.map((j, i) => ({
                ...j,
                matchScore: Math.max(50, 85 - (i * 8)),
                matchReason: ''
            }));
        }

        res.json({ jobs: rankedJobs, query: searchQuery });

    } catch (error) {
        console.error("Error fetching job recommendations:", error.message);
        if (error.response?.status === 401) {
            return res.status(500).json({ error: "Adzuna API authentication failed. Check your ADZUNA_APP_ID and ADZUNA_APP_KEY." });
        }
        res.status(500).json({ error: "Failed to fetch job recommendations", details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
