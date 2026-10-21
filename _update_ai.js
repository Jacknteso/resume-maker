var fs = require("fs");
var c = fs.readFileSync("lib/ai.js", "utf-8");

var newFns = [
"",
"async function analyzeJob(userData, jobDescription) {",
"  const candidateSkills = [",
"    ...(userData.skills || "").split(",").map(s => s.trim()).filter(Boolean),",
"    ...(userData.certifications || "").split(",").map(s => s.trim()).filter(Boolean)",
"  ];",
"  const response = await groq.chat.completions.create({",
"    model: "openai/gpt-oss-120b",",
"    temperature: 0.3,",",
"    max_tokens: 2000,",",
"    messages: [",
"      { role: "system", content: "You are a job matching analyst. Compare a candidate profile against a job description. Categorize each required or preferred skill into strong_match, partial_match, or missing. Identify the job title, company, work arrangement, and key responsibilities. Return valid JSON." },",
"      { role: "user", content: buildAnalyzePrompt(userData, candidateSkills, jobDescription) }",
"    ]",
"  });",
"  const raw = response.choices[0].message.content;",
"  const jsonStr = raw.replace(/{3}
?/g, "").trim();",
"  return JSON.parse(jsonStr);",
"}",
""
].join("
");

console.log("Writing helper");
fs.writeFileSync("_update_ai.js", "dummy");
