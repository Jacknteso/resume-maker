const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrape job description content from a URL.
 * Tries common job listing selectors, falls back to full body text.
 */
async function scrapeJobDescription(url) {
  // Check for known difficult-to-scrape sites
  const blockedDomains = ['linkedin.com/jobs', 'indeed.com/viewjob', 'glassdoor.com'];
  const isBlocked = blockedDomains.some(domain => url.includes(domain));
  
  if (isBlocked) {
    throw new Error(
      'This job site blocks automated scraping. Please copy and paste the job description directly into the summary field instead. ' +
      'The AI will still tailor your resume to match the job requirements.'
    );
  }

  try {
    // Use more realistic browser headers to avoid 403 errors
    const response = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Connection': 'keep-alive',
        'DNT': '1'
      }
    });

    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $('script, style, nav, header, footer, iframe, noscript').remove();

    // Try common job listing selectors
    const selectors = [
      '.job-description',
      '.job-details',
      '.jobDescriptionSection',
      '#jobDescriptionText',
      '.description__text',
      '.posting-requirements',
      '.content-description',
      '[data-automation="jobDescription"]',
      '.ats-searchable-job-description',
      '.jd-description',
      '#job-description',
      '.job_content',
      '.section-body',
      'article',
      'main',
      '#content',
      '#main-content'
    ];

    let jobText = '';

    for (const selector of selectors) {
      const el = $(selector);
      if (el.length && el.text().trim().length > 100) {
        jobText = el.text().trim();
        break;
      }
    }

    // Fallback: use body text
    if (!jobText) {
      jobText = $('body').text().trim();
    }

    // Clean up whitespace
    jobText = jobText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    // Truncate if extremely long (API token limits)
    if (jobText.length > 8000) {
      jobText = jobText.substring(0, 8000);
    }

    if (!jobText || jobText.length < 50) {
      throw new Error('Could not extract meaningful content from the URL. Please check the URL and try again.');
    }

    return jobText;
  } catch (error) {
    if (error.message.includes('Could not extract') || error.message.includes('Please copy and paste')) throw error;
    
    // Provide helpful error message for common scenarios
    if (error.response && error.response.status === 403) {
      throw new Error(
        'This website blocks automated access (HTTP 403). Please try one of these alternatives:\n' +
        '1. Copy the job description text and paste it into the Summary field\n' +
        '2. Use a different job posting URL\n' +
        '3. Check if the URL is publicly accessible (not behind a login)'
      );
    }
    
    if (error.response && error.response.status === 404) {
      throw new Error('Job posting not found (HTTP 404). Please check the URL and try again.');
    }
    
    throw new Error(`Failed to fetch job description: ${error.message}`);
  }
}

module.exports = { scrapeJobDescription };
