/**
 * ATS-Friendly Resume Template
 * Clean, single-column layout that parses well with applicant tracking systems.
 */

// Normalize projects to an array of {name, tech, link, bullets}.
// Legacy profiles stored projects as a free-text string.
function projectList(data) {
  const raw = data.tailoredProjects || data.projects || [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    return raw.split(/\n\s*\n/).filter(Boolean).map(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      return { name: lines[0] || '', bullets: lines.slice(1) };
    });
  }
  return [];
}

function renderResumeHTML(data) {
  // Section visibility flags (from the editor toggles; default = show)
  const show = {
    showSummary: data.showSummary !== false,
    showExperience: data.showExperience !== false,
    showEducation: data.showEducation !== false,
    showSkills: data.showSkills !== false,
    showProjects: data.showProjects !== false
  };

  const experienceHTML = (data.tailoredExperience || data.experience || []).map(exp => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <strong>${exp.title || ''}</strong> — ${exp.company || ''}
        </div>
        <div class="date">${exp.start || ''} – ${exp.end || 'Present'}</div>
      </div>
      ${exp.bullets && exp.bullets.length > 0
        ? `<ul>${exp.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`
        : exp.description
          ? `<ul><li>${exp.description}</li></ul>`
          : ''}
    </div>
  `).join('');

  // Projects: each project is its own entry with bullet points
  const projectsHTML = projectList(data)
    .filter(p => p && (p.name || p.tech || p.link || (p.bullets && p.bullets.length)))
    .map(p => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <strong>${p.name || ''}</strong>${p.tech ? ` <span class="tech">| ${p.tech}</span>` : ''}
        </div>
        ${p.link ? `<div class="date"><a href="${p.link}">${p.link.replace(/^https?:\/\//, '')}</a></div>` : ''}
      </div>
      ${p.bullets && p.bullets.length > 0
        ? `<ul>${p.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`
        : ''}
    </div>
  `).join('');

  const educationHTML = (data.education || []).map(edu => `
    <div class="entry">
      <div class="entry-header">
        <div>
          <strong>${edu.degree || ''}</strong>${edu.field ? ` in ${edu.field}` : ''} — ${edu.school || ''}
        </div>
        <div class="date">${edu.start || ''} – ${edu.end || ''}</div>
      </div>
      ${edu.gpa ? `<div class="detail">GPA: ${edu.gpa}</div>` : ''}
    </div>
  `).join('');

  const skills = data.tailoredSkills || data.skills || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resume - ${data.personal?.full_name || 'Resume'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Calibri', 'Arial', 'Helvetica Neue', sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #1a1a1a;
      padding: 40px 50px;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }

    /* === HEADER === */
    .header {
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 2px solid #222;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 22pt;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #111;
      margin-bottom: 6px;
    }
    .contact-line {
      font-size: 10pt;
      color: #333;
    }
    .contact-line a {
      color: #333;
      text-decoration: none;
    }

    /* === SECTIONS === */
    .section {
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 12pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #111;
      border-bottom: 1px solid #999;
      padding-bottom: 4px;
      margin-bottom: 10px;
    }

    /* === SUMMARY === */
    .summary {
      font-size: 10.5pt;
      color: #333;
      line-height: 1.5;
    }

    /* === ENTRIES === */
    .entry {
      margin-bottom: 14px;
    }
    .entry-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 4px;
    }
    .entry-header strong {
      font-size: 11pt;
    }
    .date {
      font-size: 10pt;
      color: #555;
      white-space: nowrap;
      margin-left: 12px;
    }
    .detail {
      font-size: 10pt;
      color: #444;
      font-style: italic;
      margin-top: 2px;
    }
    ul {
      margin-left: 18px;
      margin-top: 4px;
    }
    li {
      font-size: 10.5pt;
      margin-bottom: 3px;
      line-height: 1.4;
    }

    /* === SKILLS === */
    .skills-content {
      font-size: 10.5pt;
      line-height: 1.6;
    }

    /* === PROJECTS === */
    .tech {
      font-size: 10pt;
      color: #444;
    }

    /* === CERTIFICATIONS === */
    .certs-content {
      font-size: 10.5pt;
      line-height: 1.5;
    }

    /* Print styles */
    @media print {
      body { padding: 0.5in; }
      .header { border-bottom-color: #000; }
      .section-title { border-bottom-color: #000; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.personal?.full_name || ''}</h1>
    <div class="contact-line">
      ${data.personal?.email || ''}${data.personal?.phone ? ` | ${data.personal.phone}` : ''}${data.personal?.location ? ` | ${data.personal.location}` : ''}${data.personal?.linkedin ? ` | <a href="${data.personal.linkedin}">${data.personal.linkedin}</a>` : ''}
    </div>
  </div>

  ${show.showSummary && (data.tailoredSummary || data.summary) ? `
  <div class="section">
    <div class="section-title">Professional Summary</div>
    <div class="summary">${data.tailoredSummary || data.summary}</div>
  </div>` : ''}

  ${show.showExperience && (data.tailoredExperience || data.experience || []).length > 0 ? `
  <div class="section">
    <div class="section-title">Experience</div>
    ${experienceHTML}
  </div>` : ''}

  ${show.showEducation && (data.education || []).length > 0 ? `
  <div class="section">
    <div class="section-title">Education</div>
    ${educationHTML}
  </div>` : ''}

  ${show.showSkills && skills ? `
  <div class="section">
    <div class="section-title">Skills</div>
    <div class="skills-content">${skills}</div>
  </div>` : ''}

  ${show.showProjects && projectsHTML ? `
  <div class="section">
    <div class="section-title">Projects</div>
    ${projectsHTML}
  </div>` : ''}

  ${data.certifications ? `
  <div class="section">
    <div class="section-title">Certifications</div>
    <div class="certs-content">${data.certifications}</div>
  </div>` : ''}
</body>
</html>`;
}

/**
 * ATS-Friendly Cover Letter Template
 */
function renderCoverLetterHTML(data) {
  const paragraphs = (data.paragraphs || []).map(p => `<p>${p}</p>`).join('\n    ');
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cover Letter - ${data.personal?.full_name || ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Calibri', 'Arial', 'Helvetica Neue', sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      padding: 50px 60px;
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
    }
    .sender-info {
      margin-bottom: 30px;
    }
    .sender-info .name {
      font-size: 14pt;
      font-weight: 700;
    }
    .sender-info div {
      font-size: 10.5pt;
      color: #333;
    }
    .date {
      font-size: 10.5pt;
      margin-bottom: 24px;
      color: #333;
    }
    .body p {
      margin-bottom: 14px;
      font-size: 11pt;
    }
    .closing {
      margin-top: 30px;
    }
    .closing .sign {
      margin-top: 30px;
      font-weight: 600;
    }

    @media print {
      body { padding: 1in; }
    }
  </style>
</head>
<body>
  <div class="sender-info">
    <div class="name">${data.personal?.full_name || ''}</div>
    <div>${data.personal?.email || ''}</div>
    <div>${data.personal?.phone || ''}</div>
    <div>${data.personal?.location || ''}</div>
    ${data.personal?.linkedin ? `<div>${data.personal.linkedin}</div>` : ''}
  </div>

  <div class="date">${today}</div>

  <div class="body">
    ${paragraphs || '<p>Dear Hiring Manager,</p><p>Please find attached my resume for your consideration. I am confident that my skills and experience make me a strong candidate for this position.</p><p>Thank you for your time and consideration. I look forward to hearing from you.</p><p>Sincerely,</p>'}
  </div>

  <div class="closing">
    <div class="sign">${data.personal?.full_name || ''}</div>
  </div>
</body>
</html>`;
}


function renderResumeHTMLByTemplate(data, tpl) {
  if (tpl === "modern") return renderModernResume(data);
  if (tpl === "traditional") return renderTraditionalResume(data);
  return renderResumeHTML(data);
}
function renderModernResume(data) {
  var show = {
    showSummary: data.showSummary !== false,
    showExperience: data.showExperience !== false,
    showEducation: data.showEducation !== false,
    showSkills: data.showSkills !== false,
    showProjects: data.showProjects !== false
  };
  var exp = (data.tailoredExperience || data.experience || []).map(function(e) {
    var b = (e.bullets && e.bullets.length > 0) ? e.bullets.map(function(x){return "<li>"+x+"</li>"}).join("") : (e.description ? "<li>"+e.description+"</li>" : "");
    return "<div class=entry><div class=entry-header><strong>"+(e.title||"")+"</strong> at "+(e.company||"")+"<span class=date>"+(e.start||"")+" - "+(e.end||"Present")+"</span></div><ul>"+b+"</ul></div>";
  }).join("");
  var edu = (data.education || []).map(function(e) {
    return "<div class=entry><div class=entry-header><strong>"+(e.degree||"")+(e.field ? " in "+e.field : "")+"</strong><span class=date>"+(e.start||"")+" - "+(e.end||"")+"</span></div><div>"+(e.school||"")+(e.gpa ? " | GPA: "+e.gpa : "")+"</div></div>";
  }).join("");
  var prj = projectList(data).filter(function(p){return p && (p.name || p.tech || p.link || (p.bullets && p.bullets.length))}).map(function(p) {
    var b = (p.bullets && p.bullets.length > 0) ? p.bullets.map(function(x){return "<li>"+x+"</li>"}).join("") : "";
    return "<div class=entry><div class=eh><strong>"+(p.name||"")+"</strong>"+(p.tech?" <span class=tech>| "+p.tech+"</span>":"")+"<span class=dt>"+(p.link?p.link.replace(/^https?:\/\//,""):"")+"</span></div>"+(b?"<ul>"+b+"</ul>":"")+"</div>";
  }).join("");
  var s = data.tailoredSkills || data.skills || "";
  var css = "*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;font-size:10.5pt;line-height:1.5;color:#333;display:flex;min-height:100vh}.sb{width:220px;background:#2563eb;color:#fff;padding:30px 20px}.sb h1{font-size:18pt}.mn{flex:1;padding:30px 40px}.sec{margin-bottom:18px}.st{font-size:11pt;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #2563eb;padding-bottom:4px;margin-bottom:10px}.eh{display:flex;justify-content:space-between;margin-bottom:2px}.dt{font-size:9pt;color:#888}.tech{font-size:9.5pt;color:#555}ul{margin-left:16px;margin-top:4px}li{font-size:10pt;margin-bottom:2px;line-height:1.4}.sm{font-size:10pt;line-height:1.5}";
  var h="<!DOCTYPE html><html><head><meta charset=UTF-8><style>"+css+"</style></head><body>";
  h+="<div class=sb><h1>"+(data.personal?data.personal.full_name:"")+"</div>";
  h+="<div class=mn>";
  if(show.showSummary && (data.tailoredSummary||data.summary)) h+="<div class=sec><div class=st>Summary</div><div class=sm>"+(data.tailoredSummary||data.summary)+"</div></div>";
  if(show.showExperience && exp) h+="<div class=sec><div class=st>Experience</div>"+exp+"</div>";
  if(show.showEducation && edu) h+="<div class=sec><div class=st>Education</div>"+edu+"</div>";
  if(show.showSkills && s) h+="<div class=sec><div class=st>Skills</div><div>"+s+"</div></div>";
  if(show.showProjects && prj) h+="<div class=sec><div class=st>Projects</div>"+prj+"</div>";
  if(data.certifications) h+="<div class=sec><div class=st>Certifications</div><div>"+data.certifications+"</div></div>";
  h+="</div></body></html>";
  return h;
}
function renderTraditionalResume(data) {
  var show = {
    showSummary: data.showSummary !== false,
    showExperience: data.showExperience !== false,
    showEducation: data.showEducation !== false,
    showSkills: data.showSkills !== false,
    showProjects: data.showProjects !== false
  };
  var exp = (data.tailoredExperience || data.experience || []).map(function(e) {
    var b = (e.bullets && e.bullets.length > 0) ? e.bullets.map(function(x){return "<li>"+x+"</li>"}).join("") : (e.description ? "<li>"+e.description+"</li>" : "");
    return "<div class=entry><div class=entry-header><div><strong>"+(e.title||"")+"</strong> at "+(e.company||"")+"</div><div class=date>"+(e.start||"")+" - "+(e.end||"Present")+"</div></div><ul>"+b+"</ul></div>";
  }).join("");
  var edu = (data.education || []).map(function(e) {
    return "<div class=entry><div class=entry-header><div><strong>"+(e.degree||"")+(e.field ? " in "+e.field : "")+"</strong> - "+(e.school||"")+"</div><div class=date>"+(e.start||"")+" - "+(e.end||"")+"</div></div></div>";
  }).join("");
  var prj = projectList(data).filter(function(p){return p && (p.name || p.tech || p.link || (p.bullets && p.bullets.length))}).map(function(p) {
    var b = (p.bullets && p.bullets.length > 0) ? p.bullets.map(function(x){return "<li>"+x+"</li>"}).join("") : "";
    return "<div class=entry><div class=eh><div><strong>"+(p.name||"")+"</strong>"+(p.tech?" <span class=tech>| "+p.tech+"</span>":"")+"</div><div class=dt>"+(p.link?p.link.replace(/^https?:\/\//,""):"")+"</div></div>"+(b?"<ul>"+b+"</ul>":"")+"</div>";
  }).join("");
  var s = data.tailoredSkills || data.skills || "";
  var css = "*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;font-size:11pt;line-height:1.5;color:#222;padding:40px 50px;max-width:800px;margin:0 auto;background:#fff}.hdr{text-align:center;padding-bottom:12px;border-bottom:2px solid #222;margin-bottom:20px}.hdr h1{font-size:22pt;font-weight:700;margin-bottom:4px}.ct{font-size:10pt;color:#444}.sec{margin-bottom:18px}.st{font-size:12pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #999;padding-bottom:4px;margin-bottom:10px}.eh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px}.dt{font-size:10pt;color:#555;white-space:nowrap;margin-left:12px}.tech{font-size:10pt;color:#555}ul{margin-left:18px;margin-top:4px}li{font-size:10.5pt;margin-bottom:3px;line-height:1.4}.sm{font-size:10.5pt;line-height:1.5}";
  var h="<!DOCTYPE html><html><head><meta charset=UTF-8><style>"+css+"</style></head><body>";
  h+="<div class=hdr><h1>"+(data.personal?data.personal.full_name:"")+"</h1>";
  h+="<div class=ct>"+(data.personal?data.personal.email:"")+(data.personal&&data.personal.phone?" | "+data.personal.phone:"")+(data.personal&&data.personal.location?" | "+data.personal.location:"")+(data.personal&&data.personal.linkedin?" | "+data.personal.linkedin:"")+"</div></div>";
  if(show.showSummary && (data.tailoredSummary||data.summary)) h+="<div class=sec><div class=st>Professional Summary</div><div class=sm>"+(data.tailoredSummary||data.summary)+"</div></div>";
  if(show.showExperience && exp) h+="<div class=sec><div class=st>Experience</div>"+exp+"</div>";
  if(show.showEducation && edu) h+="<div class=sec><div class=st>Education</div>"+edu+"</div>";
  if(show.showSkills && s) h+="<div class=sec><div class=st>Skills</div><div>"+s+"</div></div>";
  if(show.showProjects && prj) h+="<div class=sec><div class=st>Projects</div>"+prj+"</div>";
  if(data.certifications) h+="<div class=sec><div class=st>Certifications</div><div>"+data.certifications+"</div></div>";
  h+="</body></html>";
  return h;
}

module.exports = { renderResumeHTML, renderCoverLetterHTML, renderResumeHTMLByTemplate };
