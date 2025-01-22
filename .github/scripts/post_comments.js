console.log("Post Comments script started");
const fs = require("fs");
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
async function postComments() {
  try {
    if (!fs.existsSync("feedbacks.json")) {
      console.log("No Feedback found. Exiting...");
      process.exit(0);
    }
    const feedbacksData = await fs.promises.readFile("feedbacks.json", "utf8");
    const feedbacks = JSON.parse(feedbacksData);
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    const pull_number = process.env.PR_NUMBER;
    for (const feedback of feedbacks) {
      const { filePath, line, commitId, issuesDescriptions, fix } = feedback;
      if (!fix) {
        console.log("Fix is not available for the issue: ", feedback);
      }

      const formattedFix = fix
        ? fix.startsWith("```") && !fix.startsWith("```csharp")
          ? fix.replace(/^```/, "```csharp") // Replace leading ``` with ```csharp
          : fix.startsWith("```csharp") && fix.endsWith("```")
          ? fix // Already properly wrapped
          : `\`\`\`csharp\n${fix}\n\`\`\`` // Wrap if not wrapped at all
        : ""; // Handle empty or undefined fix

      const body = `> **${filePath}:${line}** \n\n ${issuesDescriptions} \n ${formattedFix ? "\n" + formattedFix + "\n" : ""}`;

      try {
        await octokit.pulls.createReviewComment({
          owner,
          repo,
          pull_number,
          body,
          path: filePath,
          line,
          commit_id: commitId,
          side: "RIGHT",
        });
        console.log(`Comment posted for ${filePath} at line ${line}`);
      } catch (err) {
        console.error(
          `Failed to post comment for ${filePath}:${line}`,
          err.message
        );
      }
    }

    console.log(`All ${feedbacks.length} review comments have been posted.`);
  } catch (error) {
    console.error("Error during posting comments:", error);
    process.exit(1);
  }
}

postComments();
