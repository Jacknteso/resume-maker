/**
 * JobTailor SPA - Client-side logic
 * Profile management, routing, analysis, editor, history
 */

var currentView = "profile";
var currentAnalysis = null;
var currentJobDescription = "";
var currentResumeData = null;
var resumeRenderData = null; // underlying resume DATA for /api/render-template (currentResumeData holds rendered HTML)
var selectedSections = {summary:true,experience:true,education:true,skills:true,projects:true,certifications:true};

// ===== UTILITY =====
function esc(s) { var d = document.createElement("div"); d.appendChild(document.createTextNode(s)); return d.innerHTML; }

// ===== ROUTING =====
function navigate(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach(function(v){v.classList.remove("active")});
  document.querySelectorAll(".nav-link").forEach(function(n){n.classList.remove("active")});
  var el = document.getElementById("view-"+view);
  if (el) el.classList.add("active");
  var nav = document.querySelector('.nav-link[data-view="'+view+'"]');
  if (nav) nav.classList.add("active");
  if (view === "create") updateProfileSummary();
  if (view === "history") renderHistory();
  if (view === "profile") loadProfile();
}

// ===== PROFILE MANAGEMENT =====
function loadProfile() {
  var p = JSON.parse(localStorage.getItem("jt_profile") || "null");
  if (!p) return;
  setVal("pf_name", p.name || ""); setVal("pf_email", p.email || "");
  setVal("pf_phone", p.phone || ""); setVal("pf_location", p.location || "");
  setVal("pf_linkedin", p.linkedin || ""); setVal("pf_github", p.github || "");
  setVal("pf_summary", p.summary || ""); setVal("pf_skills", p.skills || "");
  if (typeof p.projects === "string") { p.projects = normalizeProjects(p.projects); localStorage.setItem("jt_profile", JSON.stringify(p)); }
  renderProfileProjects(p.projects); setVal("pf_certs", p.certs || "");
  if (p.education && p.education.length > 0) renderProfileEducation(p.education);
  else addProfileEducation();
  if (p.experience && p.experience.length > 0) renderProfileExperience(p.experience);
  updateProfileStatus();
}
function setVal(id, val) { var el = document.getElementById(id); if (el) el.value = val; }
function getVal(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }

function saveProfile() {
  var p = {
    name: getVal("pf_name"), email: getVal("pf_email"),
    phone: getVal("pf_phone"), location: getVal("pf_location"),
    linkedin: getVal("pf_linkedin"), github: getVal("pf_github"),
    summary: getVal("pf_summary"), skills: getVal("pf_skills"),
    projects: getProfileProjects(), certs: getVal("pf_certs"),
    education: getProfileEducation(), experience: getProfileExperience()
  };
  localStorage.setItem("jt_profile", JSON.stringify(p));
  updateProfileStatus();
}
function updateProfileStatus() {
  var p = JSON.parse(localStorage.getItem("jt_profile") || "null");
  var el = document.getElementById("profileStatus");
  var saved = document.getElementById("profileSaved");
  var hasData = p && p.name;
  if (el) el.textContent = hasData ? "✓ Profile saved" : "";
  if (saved) saved.textContent = hasData ? "✓ All changes saved" : "";
}

// ===== PROFILE EDUCATION/EXPERIENCE =====
function renderProfileEducation(eduList) {
  var c = document.getElementById("profileEducation"); c.innerHTML = "";
  eduList.forEach(function(e,i) {
    var d = document.createElement("div"); d.className = "entry-block";
    var row1 = makeRow(makeInput("School",e.school,"University"),makeInput("Degree",e.degree,"Bachelor of Science"));
    var row2 = makeRow(makeInput("Field",e.field,"Computer Science"),makeInput("Dates",e.start+" - "+e.end,"Sep 2019 - Jun 2023"));
    d.appendChild(row1); d.appendChild(row2);
    c.appendChild(d);
  });
}
function makeRow(a,b) { var r=document.createElement("div");r.className="form-row";r.appendChild(a);r.appendChild(b);return r; }
function makeInput(label,val,ph) {
  var g=document.createElement("div");g.className="form-group";
  var l=document.createElement("label");l.textContent=label;g.appendChild(l);
  var i=document.createElement("input");i.type="text";i.value=val||"";i.placeholder=ph||"";i.onchange=saveProfile;g.appendChild(i);
  return g;
}
function addProfileEducation() {
  var p = JSON.parse(localStorage.getItem("jt_profile") || "{}");
  var edu = p.education || []; edu.push({school:"",degree:"",field:"",start:"",end:""});
  p.education = edu; localStorage.setItem("jt_profile", JSON.stringify(p));
  renderProfileEducation(edu);
}
function getProfileEducation() {
  var blocks = document.querySelectorAll("#profileEducation .entry-block");
  return Array.from(blocks).map(function(b) {
    var inputs = b.querySelectorAll("input");
    var dates = (inputs[3] ? inputs[3].value : "").split(" - ");
    return {school:inputs[0]?inputs[0].value:"",degree:inputs[1]?inputs[1].value:"",field:inputs[2]?inputs[2].value:"",start:dates[0]||"",end:dates[1]||""};
  });
}
function renderProfileExperience(expList) {
  var c = document.getElementById("profileExperience"); c.innerHTML = "";
  if (!expList || expList.length === 0) {
    var empty = document.createElement("div"); empty.className = "empty-state";
    empty.innerHTML = "<p>No professional experience added. Thats okay! You can generate a CV using your education, skills and projects.</p>";
    c.appendChild(empty); return;
  }
  expList.forEach(function(e,i) {
    var d = document.createElement("div"); d.className = "entry-block";
    var row1 = makeRow(makeInput("Company / Organization",e.company,"Any employer or volunteer organization"),makeInput("Title",e.title,"Your job title"));
    var row2 = makeRow(makeInput("Dates",e.start+" - "+e.end,"Jan 2022 - Present"),document.createElement("div"));
    var g = document.createElement("div"); g.className = "form-group";
    var l = document.createElement("label"); l.textContent = "Description"; g.appendChild(l);
    var ta = document.createElement("textarea"); ta.rows = 2; ta.value = e.description || ""; ta.onchange = saveProfile; g.appendChild(ta);
    d.appendChild(row1); d.appendChild(row2); d.appendChild(g);
    c.appendChild(d);
  });
}
function addProfileExperience() {
  var p = JSON.parse(localStorage.getItem("jt_profile") || "{}");
  var exp = p.experience || []; exp.push({company:"",title:"",start:"",end:"",description:""});
  p.experience = exp; localStorage.setItem("jt_profile", JSON.stringify(p));
  renderProfileExperience(exp);
}
function getProfileExperience() {
  var blocks = document.querySelectorAll("#profileExperience .entry-block");
  return Array.from(blocks).map(function(b) {
    var inputs = b.querySelectorAll("input");
    var ta = b.querySelector("textarea");
    var dates = (inputs[2] ? inputs[2].value : "").split(" - ");
    return {company:inputs[0]?inputs[0].value:"",title:inputs[1]?inputs[1].value:"",start:dates[0]||"",end:dates[1]||"",description:ta?ta.value:""};
  });
}
function removeProfileEntry(btn, type) {
  btn.closest(".entry-block").remove(); saveProfile();
  if (type === "education") renderProfileEducation(getProfileEducation());
  if (type === "experience") renderProfileExperience(getProfileExperience());
  if (type === "project") renderProfileProjects(getProfileProjects());
}

// ===== PROFILE PROJECTS (section-per-project) =====
// Each project is its own block: name, tech stack, link, and a bullets
// textarea (one bullet per line). The CV renders each project as an entry
// with the bullets as a list.
// Legacy profiles stored projects as one free-text string; normalize any
// legacy value to the structured array (blank line = new project).
function normalizeProjects(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(/\n\s*\n/).map(function(block) {
      var lines = block.split("\n").map(function(s){return s.trim()}).filter(Boolean);
      return {name:lines[0]||"",tech:"",link:"",bullets:lines.slice(1)};
    });
  }
  return [];
}
function renderProfileProjects(projects) {
  var c = document.getElementById("profileProjects"); if (!c) return;
  c.innerHTML = "";
  var list = Array.isArray(projects) ? projects : [];
  if (list.length === 0) list = [{name:"",tech:"",link:"",bullets:[]}];
  list.forEach(function(pr) {
    var d = document.createElement("div"); d.className = "entry-block";
    var row1 = makeRow(makeInput("Project Name",pr.name,"e.g. Community Fundraiser, Thesis Research, Home Renovation"),makeInput("Tools / Skills Used",pr.tech,"e.g. Excel, Canva, Power Tools — leave blank if none"));
    var linkRow = makeRow(makeInput("Link (optional)",pr.link,"https://github.com/... or any project page"),document.createElement("div"));
    var g = document.createElement("div"); g.className = "form-group";
    var l = document.createElement("label"); l.textContent = "Bullet Points (one per line)"; g.appendChild(l);
    var ta = document.createElement("textarea"); ta.rows = 3;
    ta.placeholder = "What you did and the result, e.g.:\nOrganized a fundraiser that raised $5,000 for local schools\nManaged a team of 10 volunteers across 3 events";
    ta.value = Array.isArray(pr.bullets) ? pr.bullets.join("\n") : (pr.bullets || "");
    ta.onchange = saveProfile; g.appendChild(ta);
    var del = document.createElement("button"); del.type = "button"; del.className = "btn btn-outline btn-sm";
    del.textContent = "Remove"; del.style.marginTop = "6px";
    del.onclick = function() { removeProfileEntry(del, "project"); };
    d.appendChild(row1); d.appendChild(linkRow); d.appendChild(g); d.appendChild(del);
    c.appendChild(d);
  });
}
function addProfileProject() {
  var p = JSON.parse(localStorage.getItem("jt_profile") || "{}");
  var pr = p.projects || []; pr.push({name:"",tech:"",link:"",bullets:[]});
  p.projects = pr; localStorage.setItem("jt_profile", JSON.stringify(p));
  renderProfileProjects(pr);
}
function getProfileProjects() {
  var blocks = document.querySelectorAll("#profileProjects .entry-block");
  return Array.from(blocks).map(function(b) {
    var inputs = b.querySelectorAll("input");
    var ta = b.querySelector("textarea");
    var bullets = (ta ? ta.value : "").split("\n").map(function(s){return s.trim()}).filter(function(s){return s.length > 0});
    return {name:inputs[0]?inputs[0].value:"",tech:inputs[1]?inputs[1].value:"",link:inputs[2]?inputs[2].value:"",bullets:bullets};
  }).filter(function(pr) { return pr.name || pr.tech || pr.link || pr.bullets.length > 0; });
}

function updateProfileSummary() {
  var p = JSON.parse(localStorage.getItem("jt_profile") || "null");
  if (!p) { document.getElementById("profileSummaryStats").textContent = "Please fill out your profile first."; return; }
  var parts = [];
  var skills = (p.skills||"").split(",").filter(function(s){return s.trim()}).length;
  parts.push("Skills: "+skills);
  parts.push("Education: "+(p.education?p.education.length:0));
  parts.push("Experience: "+(p.experience?p.experience.length:0));
  parts.push("Projects: " + normalizeProjects(p.projects).length);
  document.getElementById("profileSummaryStats").textContent = parts.join(" | ");
}


function getProfileForAPI() {
  var p = JSON.parse(localStorage.getItem("jt_profile") || "null");
  if (!p) return null;
  return {
    personal: {full_name:p.name,email:p.email,phone:p.phone,location:p.location,linkedin:p.linkedin},
    summary: p.summary || "",
    education: (p.education||[]).map(function(e){return {school:e.school,degree:e.degree,field:e.field,start:e.start,end:e.end,gpa:""}}),
    experience: (p.experience||[]).map(function(e){return {company:e.company,title:e.title,start:e.start,end:e.end,description:e.description}}),
    projects: normalizeProjects(p.projects).map(function(pr){return {name:pr.name||"",tech:pr.tech||"",link:pr.link||"",bullets:pr.bullets||[]}}),
    skills: p.skills || "",
    certifications: p.certs || ""
  };
}

// ===== JOB ANALYSIS =====
async function analyzeJob() {
  var userData = getProfileForAPI();
  if (!userData) { alert("Please fill out your profile first."); return; }
  var jobUrl = getVal("cr_job_url");
  var jobText = getVal("cr_job_text");
  if (!jobText && !jobUrl) { alert("Please provide a job URL or paste the job description."); return; }
  var btn = document.getElementById("analyzeBtn");
  btn.disabled = true; btn.textContent = "Analyzing...";
  currentJobDescription = jobText || "(scraping from URL: " + jobUrl + ")";
  try {
    var res = await fetch("/api/analyze-job", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({userData:userData, jobDescription:currentJobDescription})
    });
    var data = await res.json();
    btn.disabled = false; btn.textContent = "Analyze Job Match";
    if (!data.success) { alert("Analysis failed: " + (data.error||"Unknown error")); return; }
    currentAnalysis = data.analysis;
    showAnalysis(data.analysis);
    navigate("analysis");
  } catch(e) { btn.disabled = false; btn.textContent = "Analyze Job Match"; alert("Error: "+e.message); }
}

function showAnalysis(a) {
  document.getElementById("analysisJobTitle").textContent = a.jobTitle || "Job Match Analysis";
  document.getElementById("analysisCompany").textContent = (a.company || "") + (a.location ? " | "+a.location : "");
  var pct = a.matchPercentage || 0;
  var gauge = document.getElementById("matchGauge");
  gauge.textContent = pct+"%";
  gauge.className = "match-gauge " + (pct>=70?"match-high":pct>=40?"match-medium":"match-low");
  var sh = "";
  if (a.strongMatches && a.strongMatches.length) { a.strongMatches.forEach(function(s){sh+="<span class=skill-badge skill-strong>✓ "+esc(s)+"</span>"}); }
  if (a.partialMatches && a.partialMatches.length) { a.partialMatches.forEach(function(s){sh+="<span class=skill-badge skill-partial>~ "+esc(s)+"</span>"}); }
  if (a.missing && a.missing.length) { a.missing.forEach(function(s){sh+="<span class=skill-badge skill-missing>✗ "+esc(s)+"</span>"}); }
  document.getElementById("matchSkills").innerHTML = sh;
  var rh = "";
  if (a.responsibilities && a.responsibilities.length) {
    rh = "<p style=font-weight:600;margin-bottom:6px>Key responsibilities:</p><ul style=margin-left:18px>";
    a.responsibilities.forEach(function(r){rh+="<li style=font-size:13px;color:#475569>"+esc(r)+"</li>"});
    rh += "</ul>";
  }
  document.getElementById("matchResponsibilities").innerHTML = rh;
}

// ===== DOCUMENT GENERATION =====
async function generateDocs(type) {
  var userData = getProfileForAPI();
  if (!userData) { alert("Profile required."); return; }
  navigate("editor");
  document.getElementById("editorFrame").srcdoc = "Generating...";
  try {
    var formData = new URLSearchParams();
    formData.append("full_name", userData.personal.full_name);
    formData.append("email", userData.personal.email);
    formData.append("phone", userData.personal.phone || "");
    formData.append("location", userData.personal.location || "");
    formData.append("linkedin", userData.personal.linkedin || "");
    formData.append("summary", userData.summary);
    formData.append("skills", userData.skills);
    formData.append("certifications", userData.certifications);
    userData.projects.forEach(function(pr) {
      formData.append("proj_name[]", pr.name); formData.append("proj_tech[]", pr.tech);
      formData.append("proj_link[]", pr.link); formData.append("proj_bullets[]", pr.bullets.join("\n"));
    });
    userData.education.forEach(function(e,i) {
      formData.append("edu_school[]",e.school); formData.append("edu_degree[]",e.degree);
      formData.append("edu_field[]",e.field); formData.append("edu_start[]",e.start);
      formData.append("edu_end[]",e.end); formData.append("edu_gpa[]",""); });
    userData.experience.forEach(function(e,i) {
      formData.append("exp_company[]",e.company); formData.append("exp_title[]",e.title);
      formData.append("exp_start[]",e.start); formData.append("exp_end[]",e.end);
      formData.append("exp_description[]",e.description); });
    formData.append("job_text", currentJobDescription);
    var res = await fetch("/generate", {method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:formData.toString()});
    if (res.redirected) {
      var htmlRes = await fetch("/api/resume-html");
      var htmlData = await htmlRes.json();
      resumeRenderData = userData;
      currentResumeData = htmlData.html;
      document.getElementById("editorFrame").srcdoc = htmlData.html;
      // Fresh generation resets section visibility server-side; sync the checkboxes
      document.querySelectorAll("[data-section]").forEach(function(cb) { cb.checked = true; });
      Object.keys(selectedSections).forEach(function(k) { selectedSections[k] = true; });
      saveToHistory(userData.personal.full_name, currentAnalysis);
    } else {
      document.getElementById("editorFrame").srcdoc = "<p>Error generating document</p>";
    }
  } catch(e) { document.getElementById("editorFrame").srcdoc = "<p>Error: "+e.message+"</p>"; }
}

// ===== EDITOR =====
function currentSections() {
  var s = {};
  document.querySelectorAll("[data-section]").forEach(function(cb) {
    s[cb.getAttribute("data-section")] = cb.checked;
  });
  return s;
}
function rerenderEditor() {
  if (!resumeRenderData) return;
  var tpl = document.getElementById("templateSelect").value;
  fetch("/api/render-template", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({data:resumeRenderData, template:tpl, sections:currentSections()})
  }).then(function(r){return r.json()}).then(function(d){
    if (d.html) {
      currentResumeData = d.html;
      document.getElementById("editorFrame").srcdoc = d.html;
    }
  }).catch(function(e){console.error(e)});
}
function changeTemplate() {
  rerenderEditor();
}
function toggleSection(name, enabled) {
  selectedSections[name] = enabled;
  rerenderEditor();
}
async function regenerateSection() {
  var section = prompt("Which section to regenerate? (summary, experience, skills, projects, cover_letter)");
  if (!section) return;
  var userData = getProfileForAPI();
  try {
    var res = await fetch("/api/regenerate-section", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({userData:userData, jobDescription:currentJobDescription, sectionName:section, currentContent:""})
    });
    var data = await res.json();
    if (data.success) alert(section + " regenerated! Check the preview.");
    else alert("Error: " + (data.error||"Failed"));
  } catch(e) { alert("Error: "+e.message); }
}

// ===== HISTORY =====
function saveToHistory(name, analysis) {
  var history = JSON.parse(localStorage.getItem("jt_history") || "[]");
  history.unshift({
    name: name || "Untitled",
    jobTitle: analysis ? analysis.jobTitle : "",
    company: analysis ? analysis.company : "",
    date: new Date().toISOString(),
    match: analysis ? analysis.matchPercentage : null
  });
  if (history.length > 20) history = history.slice(0,20);
  localStorage.setItem("jt_history", JSON.stringify(history));
}
function renderHistory() {
  var history = JSON.parse(localStorage.getItem("jt_history") || "[]");
  var list = document.getElementById("historyList");
  var empty = document.getElementById("historyEmpty");
  if (history.length === 0) { list.innerHTML = ""; empty.style.display = "block"; return; }
  empty.style.display = "none";
  list.innerHTML = history.map(function(h,i) {
    var d = new Date(h.date);
    var dateStr = d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
    return "<div class=history-item>" +
      "<div class=history-item-info><h4>"+esc(h.jobTitle||h.name)+"</h4>" +
      "<p>"+esc(h.company||"")+(h.match?" | "+h.match+"% match":"")+"</p></div>" +
      "<div style=display:flex;align-items:center>" +
      "<span class=history-item-date>"+dateStr+"</span>" +
      "<a class=btn-download href=/preview target=_blank>Open</a></div></div>";
  }).join("");
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", function() {
  loadProfile();
  document.querySelectorAll("#view-profile input, #view-profile textarea").forEach(function(el) {
    el.addEventListener("change", saveProfile);
  });
  // Event delegation for data-nav buttons
  document.querySelectorAll("[data-nav]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      navigate(this.getAttribute("data-nav"));
    });
  });
  // Event delegation for data-action buttons
  document.querySelectorAll("[data-action]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var action = this.getAttribute("data-action");
      var arg = this.getAttribute("data-arg");
      if (typeof window[action] === "function") {
        arg ? window[action](arg) : window[action]();
      }
    });
  });
  // Nav brand click
  var brand = document.querySelector(".nav-brand");
  if (brand) brand.addEventListener("click", function(e) { e.preventDefault(); navigate("profile"); });
  // Editor section toggles
  document.querySelectorAll("[data-section]").forEach(function(cb) {
    cb.addEventListener("change", function() {
      toggleSection(this.getAttribute("data-section"), this.checked);
    });
  });
});