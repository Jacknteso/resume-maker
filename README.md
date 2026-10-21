# 📄 Resume Maker

AI-powered resume and cover letter generator. Paste a job description URL, fill in your details, and get ATS-optimized documents tailored to the role.

## Features

- **Job Description Scraping** — Automatically extracts requirements from job posting URLs (LinkedIn, Indeed, etc.)
- **AI-Tailored Resumes** — Llama 3 70B rewrites your summary and experience with relevant keywords
- **Cover Letter Generation** — Personalized cover letters that match the job description
- **ATS-Friendly Templates** — Clean, single-column HTML templates that parse well with applicant tracking systems
- **PDF Export** — Download professional PDFs for both documents
- **Side-by-Side Preview** — View resume and cover letter before downloading
- **Self-Hosting Ready** — Docker containerization with Nginx reverse proxy
- **Production Ready** — Security headers, rate limiting, health checks

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- A **free** [Groq API key](https://console.groq.com) (sign up in 30 seconds, no credit card needed)
- [Docker](https://docs.docker.com/get-docker/) (for self-hosting)
- [Docker Compose](https://docs.docker.com/compose/install/) (for self-hosting)

## Quick Start (Development)

```bash
# Navigate to the project
cd Web\ Dev/resume-maker

# Install dependencies
npm install

# Add your Groq API key (it's free!)
cp .env.example .env
# Then edit .env and paste your key from https://console.groq.com

# Start the development server
npm run dev
```

Open **http://localhost:3000** in your browser.

## Self-Hosting with Docker

### Option 1: Docker Compose (Recommended)

This is the easiest way to run the app in production:

```bash
# 1. Clone the repository
git clone https://github.com/your-username/resume-maker.git
cd resume-maker

# 2. Create production environment file
cp .env.production .env
# Edit .env with your Groq API key and other settings

# 3. Start the application with Docker Compose
docker-compose up -d

# 4. Check if it's running
docker-compose ps

# 5. View logs
docker-compose logs -f
```

The app will be available at:
- **HTTP**: http://localhost
- **Health Check**: http://localhost/health

### Option 2: Docker Only

```bash
# Build the Docker image
docker build -t resume-maker .

# Run the container
docker run -d \
  --name resume-maker \
  -p 3000:3000 \
  -e GROQ_API_KEY=your_api_key_here \
  -e NODE_ENV=production \
  -e SESSION_SECRET=your_session_secret_here \
  resume-maker
```

### Option 3: Manual Deployment

```bash
# Install production dependencies
npm ci --only=production

# Set environment variables
export NODE_ENV=production
export GROQ_API_KEY=your_api_key_here
export SESSION_SECRET=your_session_secret_here

# Start the server
node server.js
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GROQ_API_KEY` | Your Groq API key | - | Yes |
| `PORT` | Server port | 3000 | No |
| `SESSION_SECRET` | Session encryption secret | - | Yes (production) |
| `NODE_ENV` | Environment (development/production) | development | No |
| `TRUST_PROXY` | Trust proxy headers (set to 1 behind Nginx) | - | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | 900000 (15 min) | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 | No |

### Production Configuration

For production deployment:

1. Copy `.env.production` to `.env`
2. Fill in your `GROQ_API_KEY`
3. Generate a secure `SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
4. Set `TRUST_PROXY=1` if using Nginx

## Architecture

```
resume-maker/
├── Dockerfile              # Multi-stage Docker build
├── docker-compose.yml      # Docker Compose configuration
├── nginx/                  # Nginx reverse proxy config
│   ├── nginx.conf          # Main Nginx configuration
│   └── conf.d/             # Server blocks
│       └── default.conf    # Default server configuration
├── .env.production         # Production environment template
├── server.js               # Express server & routes
├── lib/
│   ├── ai.js               # Groq/Llama 3 integration
│   ├── scraper.js          # Job description URL scraper
│   ├── templates.js        # ATS-friendly HTML templates
│   ├── pdf.js              # PDF generation with Puppeteer
│   ├── document-parser.js  # Document parsing (PDF, DOCX)
│   └── github.js           # GitHub API integration
├── public/
│   ├── index.html          # Main input form
│   ├── preview.html        # Side-by-side preview page
│   ├── css/style.css       # App UI styles
│   └── js/app.js           # Client-side form interactions
├── output/                 # Temporary PDF storage (auto-cleaned)
└── uploads/                # Uploaded documents (auto-cleaned)
```

## Security Features

- **Helmet.js**: Sets various HTTP security headers
- **Rate Limiting**: Prevents abuse (100 requests/15min general, 50/15min for APIs)
- **Secure Sessions**: HTTP-only cookies with secure flag in production
- **Nginx Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Non-root Docker User**: App runs as non-root user in container
- **Resource Limits**: Memory and CPU limits in Docker

## Health Checks

The app includes a health check endpoint at `/health` that returns:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 12345.678,
  "memoryUsage": {...},
  "cpuUsage": {...},
  "environment": "production",
  "version": "1.0.0"
}
```

Docker and Nginx both use this endpoint for health monitoring.

## SSL/TLS Setup

To enable HTTPS:

1. Obtain SSL certificates (e.g., using Let's Encrypt)
2. Place them in `nginx/ssl/`
3. Uncomment the HTTPS server block in `nginx/conf.d/default.conf`
4. Update server name and certificate paths
5. Restart Nginx: `docker-compose restart nginx`

## Monitoring

### Docker Logs

```bash
# View app logs
docker-compose logs -f app

# View Nginx logs
docker-compose logs -f nginx

# View all logs
docker-compose logs -f
```

### Health Monitoring

You can use the `/health` endpoint with monitoring tools like:
- Uptime Robot
- Pingdom
- Nagios
- Prometheus (with custom exporter)

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port 3000
   lsof -i :3000
   # Kill it or change PORT in .env
   ```

2. **Docker permission issues**
   ```bash
   # Fix upload/output directory permissions
   chmod -R 755 uploads output
   ```

3. **Nginx not starting**
   ```bash
   # Check Nginx configuration
   docker-compose exec nginx nginx -t
   ```

4. **Health check failing**
   ```bash
   # Check app logs
docker-compose logs app
   # Test health endpoint directly
curl http://localhost:3000/health
   ```

## Development

For development:

```bash
# Install dependencies
npm install

# Start with hot reload
npm run dev

# Run in development mode
NODE_ENV=development npm start
```

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Project Structure

```
resume-maker/
├── server.js              # Express server & routes
├── lib/
│   ├── ai.js              # Groq/Llama 3 integration (resume + cover letter)
│   ├── scraper.js         # Job description URL scraper
│   ├── templates.js       # ATS-friendly HTML templates
│   └── pdf.js             # PDF generation with Puppeteer
├── public/
│   ├── index.html         # Main input form
│   ├── preview.html       # Side-by-side preview page
│   ├── css/style.css      # App UI styles
│   └── js/app.js          # Client-side form interactions
├── output/                # Temporary PDF storage (auto-cleaned)
├── .env                   # Environment variables (API key)
└── package.json
```

## How It Works

1. **Enter your details** — personal info, education, work experience, skills
2. **Paste a job URL** — the app scrapes the job description automatically
3. **Click Generate** — Llama 3 70B (via Groq) tailors your resume content to match the job
4. **Preview & Download** — view both documents side-by-side, download as PDF

## About the Free API

This app uses **Groq** which provides free access to OpenAI OSS 120B model. It's:
- ✅ Completely free (no credit card required)
- ✅ Faster than most paid APIs (Groq's custom hardware)
- ✅ High quality — Llama 3 70B rivals GPT-4 for resume writing
- ✅ No rate limits for normal usage

Get your free key at [console.groq.com](https://console.groq.com).

## Customizing the Resume Template

The ATS-friendly template is defined in `lib/templates.js`. You can modify the HTML/CSS there to match your preferred style. The template uses:
- Single-column layout (ATS-optimal)
- Clean section headers
- Standard fonts (Calibri/Arial)
- No tables, columns, or graphics
