const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const OpenAI = require('openai');
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

/**
 * Extract raw text from a document file (PDF, DOCX, TXT, or other text-based formats).
 */
async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === '.docx') {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // For TXT and any other text-readable files (.md, .rtf, etc.)
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Use AI to parse academic history from raw document text.
 * Returns structured education entries.
 */
async function parseAcademicHistory(text) {
  // Truncate very long documents to stay within token limits
  const truncated = text.length > 6000 ? text.substring(0, 6000) : text;

  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    max_tokens: 2000,
    messages: [
      {
        role: 'system',
        content: `You are an expert at extracting academic information from documents.
Analyze the provided text and extract ALL academic/education history entries.
Return valid JSON with the exact structure requested.
If a field is not found, leave it as an empty string.`
      },
      {
        role: 'user',
        content: `Extract all academic history from this document text:

---
${truncated}
---

Return a JSON object with this exact structure:
{
  "education": [
    {
      "school": "University or institution name",
      "degree": "Degree type (e.g. Bachelor of Science, Master of Arts)",
      "field": "Field of study / major",
      "start": "Start date (e.g. Sep 2019, 2020)",
      "end": "End date or expected graduation (e.g. Jun 2023, Expected May 2025)",
      "gpa": "GPA if mentioned, empty string if not"
    }
  ],
  "certifications": ["Certification 1", "Certification 2"],
  "skills": "Comma-separated list of skills mentioned in the document"
}

IMPORTANT: Return ONLY the raw JSON object, no markdown code fences, no extra text.
If you cannot find education information, return {"education": [], "certifications": [], "skills": ""}`
      }
    ]
  });

  const content = response.choices[0].message.content;
  const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

/**
 * Use AI to parse an existing CV/resume into structured data.
 */
async function parseExistingCV(text) {
  const truncated = text.length > 6000 ? text.substring(0, 6000) : text;

  const response = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    temperature: 0.3,
    max_tokens: 3000,
    messages: [
      {
        role: 'system',
        content: `You are an expert at parsing resumes and CVs into structured data.
Extract ALL information from the provided CV/resume text.
Return valid JSON with the exact structure requested.
Be thorough — capture every detail. If a field is not found, use an empty string or empty array.`
      },
      {
        role: 'user',
content: `Parse this CV/resume into structured data:

---
${truncated}
---

Return a JSON object with this exact structure:
{
  "personal": {
    "full_name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": ""
  },
  "summary": "Professional summary text if present",
  "education": [
    {
      "school": "",
      "degree": "",
      "field": "",
      "start": "",
      "end": "",
      "gpa": ""
    }
  ],
  "experience": [
    {
      "company": "",
      "title": "",
      "start": "",
      "end": "",
      "description": "Brief description of role and responsibilities"
    }
  ],
  "skills": "Comma-separated skills",
  "certifications": "Certifications listed",
  "projects": "Notable projects listed"
}

IMPORTANT: Return ONLY the raw JSON object, no markdown code fences, no extra text.`
      }
    ]
  });

  const content = response.choices[0].message.content;
  const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(jsonStr);
}

module.exports = { extractText, parseAcademicHistory, parseExistingCV };
