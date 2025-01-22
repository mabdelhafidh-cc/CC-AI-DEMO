const fs = require("fs");
const { Octokit } = require("@octokit/rest");

const cachePath = ".github/cache/cache.json";
const prId = process.env.PR_NUMBER;
const cacheId = `${process.env.RUNNER_OS}-pr-cache-${process.env.PR_NUMBER}`; // Cache key to delete
const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function getRepositoryCache() {
  const caches = await octokit.request('GET /repos/{owner}/{repo}/actions/caches', {
    owner: owner,
    repo: repo,
    headers: {
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
  console.log(`Found ${JSON.stringify(caches?.data)} caches for repository ${owner}/${repo}`);
  return caches?.data?.actions_caches?.filter(c => c?.key.startsWith(cacheId)).map(c => c?.key);
}
async function deleteCacheByKey(cacheKey) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/caches?key=${cacheKey}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    return response;
  }
  catch (error) {
    console.log('Error deleting cache:', error.message);
    return {};
  }

}

async function deleteGithubCache() {
    try {
      const prCaches = await getRepositoryCache();

      for(const prCache of prCaches){
        console.log(`Attempting to delete cache with key: ${prCache}`);
        const response = await deleteCacheByKey(prCache);

        if (response?.status === 200) {
          console.log(`Cache with key ${prCache} deleted successfully.`);
        } else {
          console.error(`Failed to delete cache. Response: ${prCache}`);
        }
      }
    } catch (error) {
      console.error(`Error deleting cache: ${error.message}`);
    }
  }
  
(async function cleanupResources() {

  try {
    // Load cache
    await deleteGithubCache();
    if (!fs.existsSync(cachePath)) {
      console.error("Cache file not found. Skipping cleanup.");
      process.exit(0);
    }
    const cacheData = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    const prCache = cacheData[prId];

    if (!prCache || prCache.reviewedCommits || prCache.reviewedCommits.length === 0) {
      console.log("No cache found for this PR. Skipping cleanup.");
    }
    delete cacheData[prId];
    // Clear cache for the PR
    console.log(`cleared Pr ${prId} cache from cache.json file`);
  } catch (error) {
    console.error("Error during cleanup:", error.message);
  }
})();
