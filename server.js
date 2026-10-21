require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const os = require('os');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { scrapeJobDescription } = require('./lib/scraper');
const { generateResume, generateCoverLetter, analyzeJob, regenerateSection } = require('./lib/ai');
const { renderResumeHTML, renderCoverLetterHTML, renderResumeHTMLByTemplate } = require('./lib/templates');
const { generatePDF } = require('./lib/pdf');
const { extractText, parseAcademicHistory, parseExistingCV } = require('./lib/document-parser');
const { fetchRepos, buildProjectsText } = require('./lib/github');

const app = express();
const PORT = process.env.PORT === '0' || !process.env.PORT ? 3000 : parseInt(process.env.PORT);

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use((_req, res, next) => {
  // frame-src must allow blob: so the preview page can render the generated
  // resume/cover-letter HTML inside srcdoc iframes (srcdoc frames inherit this
  // policy and are matched by 'self' via the parent URL — 'about:srcdoc' is
  // not a valid CSP source expression and Chrome warns if you add it).
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; frame-src 'self' blob:");
  next();
});

// Trust proxy (for rate limiting behind Nginx)
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 API requests per window
  message: 'Too many API requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use('/', generalLimiter);
app.use('/api/', apiLimiter);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// File-based session store: generated CVs and editor toggle state survive
// server restarts (each session is a JSON file under .sessions/).
const FileStore = require('session-file-store')(session);
const sessionsDir = path.join(__dirname, '.sessions');
fs.mkdirSync(sessionsDir, { recursive: true });
app.use(session({
  store: new FileStore({
    path: sessionsDir,
    ttl: 24 * 60 * 60, // seconds — matches the 24h cookie maxAge
    logFn: function() {} // silence store chatter in the server log
  }),
  secret: process.env.SESSION_SECRET || 'resume_maker_secret',
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// File upload configuration
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt', '.md', '.rtf', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Please upload PDF, DOCX, TXT, MD, or RTF files.`));
    }
  }
});

// Ensure output directories exist
['output', 'uploads'].forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Helper to clean up uploaded file
function cleanupFile(filePath) {
  try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
}

// Build a ZIP (STORE method, no compression) using Node's built-in zlib.
// Avoids adding a dependency just to bundle two PDFs for download.
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}

function createZip(files, outPath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const file of files) {
      const data = fs.readFileSync(file.path);
      const nameBuf = Buffer.from(file.name, 'utf8');
      const crc = crc32(data);

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);   // local file header signature
      local.writeUInt16LE(20, 4);            // version needed
      local.writeUInt16LE(0x0800, 6);        // flags: UTF-8 name
      local.writeUInt16LE(0, 8);             // method: store
      local.writeUInt16LE(0, 10);            // mod time
      local.writeUInt16LE(0x21, 12);         // mod date (1980-01-01)
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(data.length, 18);  // compressed size
      local.writeUInt32LE(data.length, 22);  // uncompressed size
      local.writeUInt16LE(nameBuf.length, 26);
      local.writeUInt16LE(0, 28);            // extra field length

      chunks.push(local, nameBuf, data);

      const cen = Buffer.alloc(46);
      cen.writeUInt32LE(0x02014b50, 0);      // central dir signature
      cen.writeUInt16LE(20, 4);              // version made by
      cen.writeUInt16LE(20, 6);              // version needed
      cen.writeUInt16LE(0x0800, 8);          // flags: UTF-8 name
      cen.writeUInt16LE(0, 10);              // method: store
      cen.writeUInt16LE(0, 12);              // mod time
      cen.writeUInt16LE(0x21, 14);           // mod date
      cen.writeUInt32LE(crc, 16);
      cen.writeUInt32LE(data.length, 20);
      cen.writeUInt32LE(data.length, 24);
      cen.writeUInt16LE(nameBuf.length, 28);
      cen.writeUInt16LE(0, 30);              // extra len
      cen.writeUInt16LE(0, 32);              // comment len
      cen.writeUInt16LE(0, 34);              // disk number
      cen.writeUInt16LE(0, 36);              // internal attrs
      cen.writeUInt32LE(0, 38);              // external attrs
      cen.writeUInt32LE(offset, 42);         // local header offset

      central.push(Buffer.concat([cen, nameBuf]));
      offset += local.length + nameBuf.length + data.length;
    }

    const centralBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);        // end of central dir signature
    end.writeUInt16LE(0, 4);                 // disk number
    end.writeUInt16LE(0, 6);                 // disk with central dir
    end.writeUInt16LE(files.length, 8);      // entries on this disk
    end.writeUInt16LE(files.length, 10);     // total entries
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);           // central dir offset
    end.writeUInt16LE(0, 20);                // comment len

    fs.writeFile(outPath, Buffer.concat([...chunks, centralBuf, end]), (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

// ===== ROUTES =====

// Home page - input form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Process form → generate resume + cover letter
app.post('/generate', async (req, res) => {
  try {
    const {
      full_name, email, phone, location, linkedin,
      summary, job_url, job_text,
      // Academic history (multiple entries)
      edu_school, edu_degree, edu_field, edu_start, edu_end, edu_gpa,
      // Work experience (multiple entries)
      exp_company, exp_title, exp_start, exp_end, exp_description,
      // Projects (multiple entries: each becomes its own CV section)
      proj_name, proj_tech, proj_link, proj_bullets,
      // Skills
      skills, certifications
    } = req.body;

    // Store user data in session
    const userData = {
      personal: { full_name, email, phone, location, linkedin },
      summary: summary || '',
      education: Array.isArray(edu_school)
        ? edu_school.map((school, i) => ({
            school: school,
            degree: edu_degree[i],
            field: edu_field[i],
            start: edu_start[i],
            end: edu_end[i],
            gpa: edu_gpa[i]
          }))
        : [{ school: edu_school, degree: edu_degree, field: edu_field, start: edu_start, end: edu_end, gpa: edu_gpa }],
      experience: Array.isArray(exp_company)
        ? exp_company.map((company, i) => ({
            company,
            title: exp_title[i],
            start: exp_start[i],
            end: exp_end[i],
            description: exp_description[i]
          }))
        : [{ company: exp_company, title: exp_title, start: exp_start, end: exp_end, description: exp_description }],
      skills: skills || '',
      certifications: certifications || '',
      // Projects as structured entries: {name, tech, link, bullets[]}
      projects: Array.isArray(proj_name)
        ? proj_name.map((name, i) => ({
            name: name || '',
            tech: proj_tech[i] || '',
            link: proj_link[i] || '',
            bullets: (proj_bullets[i] || '').split('\n').map(b => b.trim()).filter(Boolean)
          })).filter(p => p.name || p.tech || p.link || p.bullets.length > 0)
        : proj_name ? [{
            name: proj_name,
            tech: proj_tech || '',
            link: proj_link || '',
            bullets: (proj_bullets || '').split('\n').map(b => b.trim()).filter(Boolean)
          }].filter(p => p.name || p.tech || p.link || p.bullets.length > 0)
        : []
    };

    // Get job description from URL or pasted text
    let jobDescription = '';
    if (job_text && job_text.trim()) {
      jobDescription = job_text.trim();
    } else if (job_url) {
      try {
        jobDescription = await scrapeJobDescription(job_url);
      } catch (scrapeError) {
        // If scraping fails, return a helpful error
        return res.status(400).send(`
          <div style="font-family:sans-serif;max-width:600px;margin:60px auto;text-align:center;">
            <h2 style="color:#dc3545;">⚠️ Could Not Fetch Job Description</h2>
            <p>${scrapeError.message}</p>
            <br>
            <p><strong>Tip:</strong> You can paste the job description text directly in the form and try again.</p>
            <a href="/" style="color:#0d6efd;">← Go back and paste the job description</a>
          </div>
        `);
      }
    }

    // Generate tailored resume content via OpenAI
    const resumeData = await generateResume(userData, jobDescription);

    // Generate cover letter via OpenAI
    const coverLetterData = await generateCoverLetter(userData, jobDescription);

    // Store generated data in session
    req.session.resumeData = { ...userData, ...resumeData };
    req.session.coverLetterData = { ...userData, ...coverLetterData };

    // Redirect to preview page
    res.redirect('/preview');
  } catch (error) {
    console.error('Generation error:', error.message);
    res.status(500).send(`
      <div style="font-family:sans-serif;max-width:600px;margin:60px auto;text-align:center;">
        <h2 style="color:#dc3545;">Generation Error</h2>
        <p>${error.message}</p>
        <a href="/" style="color:#0d6efd;">← Go back and try again</a>
      </div>
    `);
  }
});

// ===== NEW: Upload academic document to extract education info =====
app.post('/api/parse-academic', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const text = await extractText(req.file.path);
    if (!text || text.trim().length < 20) {
      cleanupFile(req.file.path);
      return res.status(400).json({ error: 'Could not extract meaningful text from the document.' });
    }

    const parsed = await parseAcademicHistory(text);
    cleanupFile(req.file.path);

    res.json({
      success: true,
      education: parsed.education || [],
      certifications: parsed.certifications || [],
      skills: parsed.skills || ''
    });
  } catch (error) {
    cleanupFile(req.file.path);
    console.error('Academic parse error:', error.message);
    res.status(500).json({ error: `Failed to parse document: ${error.message}` });
  }
});

// ===== NEW: Upload existing CV to extract all data =====
app.post('/api/parse-cv', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const text = await extractText(req.file.path);
    if (!text || text.trim().length < 20) {
      cleanupFile(req.file.path);
      return res.status(400).json({ error: 'Could not extract meaningful text from the document.' });
    }

    const parsed = await parseExistingCV(text);
    cleanupFile(req.file.path);

    res.json({ success: true, data: parsed });
  } catch (error) {
    cleanupFile(req.file.path);
    console.error('CV parse error:', error.message);
    res.status(500).json({ error: `Failed to parse CV: ${error.message}` });
  }
});

// ===== NEW: Fetch GitHub repos for a username =====
app.get('/api/github/repos/:username', async (req, res) => {
  try {
    const repos = await fetchRepos(req.params.username);
    res.json({ success: true, repos });
  } catch (error) {
    console.error('GitHub fetch error:', error.message);
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'GitHub user not found. Please check the username.' });
    }
    res.status(500).json({ error: `Failed to fetch GitHub repos: ${error.message}` });
  }
});

// ===== NEW: Build projects text from selected GitHub repos =====
app.post('/api/github/build-projects', async (req, res) => {
  try {
    const { username, repos } = req.body;
    if (!username || !repos || !Array.isArray(repos) || repos.length === 0) {
      return res.status(400).json({ error: 'Username and at least one repo are required.' });
    }

    const projects = await buildProjectsText(username, repos);
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Build projects error:', error.message);
    res.status(500).json({ error: `Failed to build projects: ${error.message}` });
  }
});

// Preview page - shows both resume and cover letter
app.get('/preview', (req, res) => {
  if (!req.session.resumeData) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'preview.html'));
});

// API: Get resume HTML
app.get('/api/resume-html', (req, res) => {
  if (!req.session.resumeData) {
    return res.status(404).json({ error: 'No resume data found' });
  }
  const html = renderResumeHTML(req.session.resumeData);
  res.json({ html });
});

// API: Get cover letter HTML
app.get('/api/cover-letter-html', (req, res) => {
  if (!req.session.coverLetterData) {
    return res.status(404).json({ error: 'No cover letter data found' });
  }
  const html = renderCoverLetterHTML(req.session.coverLetterData);
  res.json({ html });
});

// Download resume PDF
app.get('/download/resume', async (req, res) => {
  if (!req.session.resumeData) return res.redirect('/');
  try {
    const html = renderResumeHTML(req.session.resumeData);
    const pdfPath = path.join(__dirname, 'output', `resume_${Date.now()}.pdf`);
    await generatePDF(html, pdfPath);
    res.download(pdfPath, 'resume.pdf', () => {
      // Clean up after download
      setTimeout(() => fs.unlinkSync(pdfPath), 5000);
    });
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).send('Error generating PDF');
  }
});

// Download cover letter PDF
app.get('/download/cover-letter', async (req, res) => {
  if (!req.session.coverLetterData) return res.redirect('/');
  try {
    const html = renderCoverLetterHTML(req.session.coverLetterData);
    const pdfPath = path.join(__dirname, 'output', `cover_letter_${Date.now()}.pdf`);
    await generatePDF(html, pdfPath);
    res.download(pdfPath, 'cover_letter.pdf', () => {
      setTimeout(() => fs.unlinkSync(pdfPath), 5000);
    });
  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).send('Error generating PDF');
  }
});

// Download both PDFs as a single ZIP (HTTP allows only one body per response,
// so sequential res.download() calls cannot work — bundle instead).
app.get('/download/both', async (req, res) => {
  if (!req.session.resumeData) return res.redirect('/');
  const resumePath = path.join(__dirname, 'output', `resume_${Date.now()}.pdf`);
  const coverPath = path.join(__dirname, 'output', `cover_letter_${Date.now()}.pdf`);
  const zipPath = path.join(__dirname, 'output', `application_${Date.now()}.zip`);
  try {
    const resumeHtml = renderResumeHTML(req.session.resumeData);
    const coverHtml = renderCoverLetterHTML(req.session.coverLetterData);

    await Promise.all([
      generatePDF(resumeHtml, resumePath),
      generatePDF(coverHtml, coverPath)
    ]);

    await createZip([
      { name: 'resume.pdf', path: resumePath },
      { name: 'cover_letter.pdf', path: coverPath }
    ], zipPath);

    res.download(zipPath, 'application.zip', () => {
      setTimeout(() => {
        for (const p of [resumePath, coverPath, zipPath]) {
          try { fs.unlinkSync(p); } catch (e) { /* ignore */ }
        }
      }, 5000);
    });
  } catch (err) {
    console.error('PDF error:', err);
    for (const p of [resumePath, coverPath, zipPath]) {
      try { fs.unlinkSync(p); } catch (e) { /* ignore */ }
    }
    res.status(500).send('Error generating PDFs');
  }
});

// ===== JOB ANALYSIS ENDPOINT =====
app.post("/api/analyze-job", async (req, res) => {
  try {
    const { userData, jobDescription } = req.body;
    if (!jobDescription) {
      return res.status(400).json({ error: "Job description is required." });
    }
    const result = await analyzeJob(userData, jobDescription);
    res.json({ success: true, analysis: result });
  } catch (error) {
    console.error("Analyze error:", error.message);
    res.status(500).json({ error: "Failed to analyze job: " + error.message });
  }
});

// ===== REGENERATE SECTION ENDPOINT =====
app.post("/api/regenerate-section", async (req, res) => {
  try {
    const { userData, jobDescription, sectionName, currentContent } = req.body;
    if (!sectionName) {
      return res.status(400).json({ error: "Section name is required." });
    }
    const result = await regenerateSection(userData, jobDescription, sectionName, currentContent);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Regenerate error:", error.message);
    res.status(500).json({ error: "Failed to regenerate section: " + error.message });
  }
});

// ===== RENDER TEMPLATE ENDPOINT =====
app.post("/api/render-template", (req, res) => {
  try {
    const { data, template, sections } = req.body;
    if (!data) {
      return res.status(400).json({ error: "Resume data is required." });
    }
    // Merge the editor's section visibility flags into the data
    const merged = sections && typeof sections === "object"
      ? { ...data, ...sections }
      : data;
    // Persist the section visibility flags to the session so PDF downloads,
    // the Documents preview, and template switches all stay in sync.
    const SHOW_FLAGS = ["showSummary", "showExperience", "showEducation", "showSkills", "showProjects"];
    if (req.session.resumeData) {
      SHOW_FLAGS.forEach(flag => {
        if (typeof sections?.[flag] === "boolean") {
          req.session.resumeData[flag] = sections[flag];
        } else if (!(flag in req.session.resumeData)) {
          req.session.resumeData[flag] = true;
        }
      });
    }
    const html = renderResumeHTMLByTemplate(merged, template || "ats-minimal");
    res.json({ success: true, html });
  } catch (error) {
    console.error("Render error:", error.message);
    res.status(500).json({ error: "Failed to render template: " + error.message });
  }
});
// ===== HEALTH CHECK ENDPOINT =====
app.get('/health', (req, res) => {
  const healthcheck = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version
  };
  
  // Check if essential directories exist
  const dirsCheck = ['output', 'uploads'].every(dir => {
    const dirPath = path.join(__dirname, dir);
    return fs.existsSync(dirPath);
  });
  
  if (!dirsCheck) {
    healthcheck.status = 'degraded';
    healthcheck.message = 'Some directories are missing';
  }
  
  // Check memory usage (warn if over 80%)
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;
  
  if (memoryUsagePercent > 80) {
    healthcheck.status = 'degraded';
    healthcheck.message = 'High memory usage';
  }
  
  res.json(healthcheck);
});

// ===== SYSTEM INFO ENDPOINT (for monitoring) =====
app.get('/api/system-info', (req, res) => {
  // Only allow in development or if authenticated
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Not available in production' });
  }
  
  res.json({
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    loadAverage: os.loadavg(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem()
  });
});

// Start server
app.listen(PORT, process.env.TRUST_PROXY ? '0.0.0.0' : undefined, () => {
  console.log(`\n🚀 Resume Maker running at http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`🔒 Running in production mode`);
  }
  console.log('');
});
