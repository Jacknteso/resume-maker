const OpenAI = require('openai');

// Groq provides a free, OpenAI-compatible API with Llama 3 70B
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

/**
 * Format the structured projects array ({name, tech, link, bullets[]}) as
 * readable text for LLM prompts.
 */
function formatProjects(projects) {
  if (!Array.isArray(projects) || projects.length === 0) return 'None';
  return projects.map(p => {
    const bullets = (p.bullets || []).map(b => `\n  - ${b}`).join('');
    return `- ${p.name || 'Unnamed project'}${p.tech ? ' | Tools/Skills: ' + p.tech : ''}${p.link ? ' | ' + p.link : ''}${bullets}`;
  }).join('\n');
}

/**
 * Build a resume tailored to the job description.
 * Returns structured data for the ATS-friendly template.
 */
async function generateResume(userData, jobDescription) {
  const prompt = buildResumePrompt(userData, jobDescription);

  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    temperature: 0.7,
    max_tokens: 3000,
    messages: [
      {
        role: 'system',
        content: `You are a professional resume writer and career coach. 
You craft ATS-friendly resumes that are tailored to specific job descriptions.
Always return valid JSON with the exact structure requested.
Use action verbs, quantify achievements where possible, and mirror keywords from the job description.`
      },
      { role: 'user', content: prompt }
    ]
  });

  const content = response.choices[0].message.content;

  // Groq may wrap JSON in markdown code blocks — strip them
  const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(jsonStr);

  return {
    tailoredSummary: parsed.summary || userData.summary,
    tailoredExperience: parsed.experience || userData.experience,
    tailoredSkills: parsed.skills || userData.skills,
    tailoredProjects: Array.isArray(parsed.projects) && parsed.projects.length > 0
      ? parsed.projects
      : userData.projects,
    keywords: parsed.keywords || []
  };
}

/**
 * Build a personalized cover letter for the job application.
 */
async function generateCoverLetter(userData, jobDescription) {
  const prompt = `Write a professional, compelling cover letter for the following job application.

CANDIDATE INFORMATION:
- Name: ${userData.personal.full_name}
- Email: ${userData.personal.email}
- Phone: ${userData.personal.phone}
- Location: ${userData.personal.location}
- LinkedIn: ${userData.personal.linkedin || 'N/A'}

CANDIDATE SUMMARY:
${userData.summary}

EDUCATION:
${userData.education.map(e => `- ${e.degree} in ${e.field}, ${e.school} (${e.start} - ${e.end})`).join('\n')}

WORK EXPERIENCE:
${userData.experience.map(e => `- ${e.title} at ${e.company} (${e.start} - ${e.end})\n  ${e.description}`).join('\n')}SKILLS: ${userData.skills}

PROJECTS:
${formatProjects(userData.projects)}

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}` : 'No job description was provided. Write a general professional cover letter.'}

---
Write the cover letter with:
1. A strong opening paragraph that mentions the specific role and why you're excited about it
2. 1-2 body paragraphs highlighting relevant experience and skills that match the job requirements
3. A closing paragraph with a call to action
4. Keep it under 400 words
5. Use a professional but personable tone
6. Mirror keywords from the job description naturally
7. The candidate may work in ANY industry — use the vocabulary of their field and the job posting, and never assume a software or IT background`;

  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    temperature: 0.7,
    max_tokens: 1500,
    messages: [
      {
        role: 'system',
        content: `You are a professional cover letter writer. 
Write compelling, personalized cover letters that help candidates stand out.
Be specific, avoid generic phrases, and tailor the content to the job description.
Return ONLY the cover letter text, no headers or labels.`
      },
      { role: 'user', content: prompt }
    ]
  });

  const letterText = response.choices[0].message.content.trim();

  // Parse the letter into paragraphs
  const paragraphs = letterText
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return {
    paragraphs,
    rawText: letterText
  };
}

function buildResumePrompt(userData, jobDescription) {
  return `Create a tailored, ATS-optimized resume based on this candidate profile and job description.

CANDIDATE PROFILE:
Name: ${userData.personal.full_name}
Email: ${userData.personal.email}
Phone: ${userData.personal.phone}
Location: ${userData.personal.location}
LinkedIn: ${userData.personal.linkedin || 'N/A'}

Summary: ${userData.summary}

Education:
${userData.education.map(e => `- ${e.degree} in ${e.field} from ${e.school} (${e.start} - ${e.end})${e.gpa ? ', GPA: ' + e.gpa : ''}`).join('\n')}

Work Experience:
${userData.experience.map(e => `- ${e.title} at ${e.company} (${e.start} - ${e.end})\n  Description: ${e.description}`).join('\n')}

Skills: ${userData.skills}
Certifications: ${userData.certifications || 'None'}

Projects (structured entries):
${formatProjects(userData.projects)}

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription}` : 'No job description provided. Optimize the resume for general use.'}

---
Return a JSON object with this exact structure:
{
  "summary": "A tailored professional summary (2-3 sentences) that highlights relevant experience for this specific job",
  "experience": [
    {
      "company": "company name",
      "title": "job title",
      "start": "start date",
      "end": "end date",
      "bullets": ["bullet point 1 with action verb and quantified result", "bullet point 2", ...]
    }
  ],
  "skills": "Comma-separated skills, reordered to prioritize those matching the job description",
  "projects": [
    {
      "name": "project name (keep the same projects and order as the input)",
      "tech": "tools, methods, or skills used, reordered to prioritize those matching the job description (leave empty string if none)",
      "link": "link (unchanged from input)",
      "bullets": ["rewritten bullet with action verb and quantified result", "bullet 2", ...]
    }
  ],
  "keywords": ["keyword1", "keyword2", ...]
}

IMPORTANT: Return ONLY the raw JSON object, no markdown code fences, no extra text.

Make sure to:
1. Mirror keywords from the job description
2. Use strong action verbs
3. Quantify achievements where possible
4. Keep bullet points concise (1-2 lines each)
5. Prioritize the most relevant experience
6. Rewrite each project's bullet points to highlight relevance to the job, using action verbs and metrics; keep every project and the same number of bullets or fewer

The candidate may work in ANY industry — healthcare, education, trades, hospitality, retail, finance, creative, public service, IT, or others. Adapt vocabulary, achievements, and metrics to the candidate's actual field and the job posting (e.g. patient outcomes for healthcare, sales figures for retail, classroom results for education). Never assume a software or IT background.`;
}
function stripFences(text) {
  var s = text;
  while (s.indexOf(String.fromCharCode(96)+String.fromCharCode(96)+String.fromCharCode(96)) >= 0) {
    s = s.split(String.fromCharCode(96)+String.fromCharCode(96)+String.fromCharCode(96)).join("");
  }
  return s.replace("json", "").trim();
}

async function analyzeJob(userData, jobDescription) {
  var candidateSkills = []
    .concat((userData.skills || "").split(",").map(function(s){return s.trim()}).filter(Boolean))
    .concat((userData.certifications || "").split(",").map(function(s){return s.trim()}).filter(Boolean));
  var response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    temperature: 0.3,
    max_tokens: 2000,
    messages: [{
      role: "system",
      content: "You are a job matching analyst. Compare a candidate profile against a job description for ANY industry (healthcare, education, trades, hospitality, finance, IT, etc.). Treat 'skills' broadly: tools, methods, licenses, certifications, languages, and competencies. Categorize each required or preferred skill into strong_match, partial_match, or missing. Identify job title, company, work arrangement, and key responsibilities. Return valid JSON."
    }, {
      role: "user",
      content: buildAnalyzeContent(userData, candidateSkills, jobDescription)
    }]
  });
  return JSON.parse(stripFences(response.choices[0].message.content));
}

function buildAnalyzeContent(userData, skills, jobDesc) {
  var parts = [];
  parts.push("Analyze this job description against the candidate profile:");
  parts.push("");
  parts.push("CANDIDATE SKILLS: " + skills.join(", "));
  parts.push("CANDIDATE EDUCATION: " + userData.education.map(function(e){return e.degree + " in " + e.field + ", " + e.school}).join("; "));
  parts.push("CANDIDATE EXPERIENCE: " + userData.experience.map(function(e){return e.title + " at " + e.company}).join("; "));
  parts.push("CANDIDATE CERTIFICATIONS: " + (userData.certifications || "None"));
  parts.push("CANDIDATE PROJECTS: " + formatProjects(userData.projects));
  parts.push("");
  parts.push("JOB DESCRIPTION:");
  parts.push(jobDesc);
  parts.push("");
  parts.push("Return ONLY the raw JSON with: jobTitle, company, location, matchPercentage (0-100), strongMatches[], partialMatches[], missing[], responsibilities[], note.");
  return parts.join(String.fromCharCode(10));
}

async function regenerateSection(userData, jobDescription, sectionName, currentContent) {
  var prompts = {
    summary: "Write a new professional summary (2-3 sentences) tailored to this job.",
    experience: "Rewrite experience bullet points with stronger action verbs.",
    skills: "Reorder skills to match the job description.",
    projects: "Rewrite projects to highlight relevance.",
    cover_letter: "Rewrite the cover letter with fresh opening and stronger body."
  };
  var prompt = prompts[sectionName] || "Improve this section.";
  var response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    temperature: 0.7,
    max_tokens: 1500,
    messages: [{
      role: "system",
      content: "You are a professional resume writer. Improve the specified section. Return valid JSON with the key being the section name."
    }, {
      role: "user",
      content: buildRegenContent(prompt, userData, jobDescription, sectionName, currentContent)
    }]
  });
  return JSON.parse(stripFences(response.choices[0].message.content));
}

function buildRegenContent(prompt, userData, jobDesc, section, current) {
  var parts = [];
  parts.push(prompt);
  parts.push("");
  parts.push("CANDIDATE: " + (userData.personal ? userData.personal.full_name : ""));
  parts.push("SKILLS: " + (userData.skills || ""));
  parts.push("JOB: " + (jobDesc || "None"));
  parts.push("");
  parts.push("CURRENT CONTENT:");
  parts.push(typeof current === "string" ? current : JSON.stringify(current));
  parts.push("");
  parts.push("Return a JSON object with key " + String.fromCharCode(34) + section + String.fromCharCode(34) + " containing improved content. Return ONLY the raw JSON.");
  return parts.join(String.fromCharCode(10));
}

module.exports = { generateResume, generateCoverLetter, analyzeJob, regenerateSection };