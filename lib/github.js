const axios = require('axios');

/**
 * Fetch all public repositories for a GitHub username.
 * Returns repos sorted by stars (descending), then last pushed date.
 */
async function fetchRepos(username) {
  const repos = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await axios.get(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos`,
      {
        params: {
          per_page: perPage,
          page,
          sort: 'updated',
          direction: 'desc'
        },
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Resume-Maker-App'
        }
      }
    );

    const data = response.data;
    if (!Array.isArray(data) || data.length === 0) break;

    repos.push(...data);
    if (data.length < perPage) break;
    page++;
  }

  // Filter out forks and sort by stars
  return repos
    .filter(repo => !repo.fork)
    .map(repo => ({
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description || '',
      html_url: repo.html_url,
      homepage: repo.homepage || '',
      language: repo.language || 'Unknown',
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      topics: repo.topics || [],
      updated_at: repo.updated_at,
      created_at: repo.created_at
    }))
    .sort((a, b) => b.stars - a.stars);
}

/**
 * Fetch the README content for a specific repo.
 */
async function fetchReadme(username, repoName) {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${encodeURIComponent(username)}/${encodeURIComponent(repoName)}/readme`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3.raw',
          'User-Agent': 'Resume-Maker-App'
        }
      }
    );
    // Truncate long READMEs
    const text = typeof response.data === 'string' ? response.data : '';
    return text.length > 2000 ? text.substring(0, 2000) + '...' : text;
  } catch {
    return '';
  }
}

/**
 * Build a formatted projects string from selected GitHub repos.
 */
async function buildProjectsText(username, selectedRepos) {
  const projects = [];

  for (const repo of selectedRepos) {
    let description = repo.description;

    // If no description, try fetching the README
    if (!description) {
      const readme = await fetchReadme(username, repo.name);
      if (readme) {
        // Take the first meaningful paragraph
        const firstParagraph = readme
          .split('\n\n')
          .find(p => p.trim().length > 20 && !p.startsWith('#'));
        description = firstParagraph || readme.substring(0, 200);
      }
    }

    const details = [];
    if (repo.language && repo.language !== 'Unknown') details.push(repo.language);
    if (repo.stars > 0) details.push(`${repo.stars} stars`);
    if (repo.topics.length > 0) details.push(repo.topics.slice(0, 3).join(', '));

    projects.push({
      name: repo.name,
      url: repo.html_url,
      description: description || 'No description available',
      details: details.join(' | ')
    });
  }

  return projects;
}

module.exports = { fetchRepos, fetchReadme, buildProjectsText };
