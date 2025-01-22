// Generate Feedback Script
const fs = require("fs");
const { execSync } = require("child_process");
const { OpenAI } = require("openai");

const cachePath = ".github/cache/cache.json";
const rulesPath = ".github/rules/rules.json";
const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_TOKENS = 8000;
const RESERVED_TOKENS = 1000;
const CHARACTERS_PER_TOKEN = 4;
const AVERAGE_LINE_CHARACTERS = 80;

const assistantInstruction = `You are an AI code reviewer. Your task is to evaluate the provided code changes against a set of given rules.
For each code snippet:
1. Review the code against **each rule** individually.
2. Report **every violation** you find in a separate JSON object.
3. If multiple rules are violated in the same code snippet, create separate JSON objects for each violation.
4. Include fixes for each issue in the JSON response, specific to the violation being addressed. 
5. Always look at the line before and after to understand if an issue is happening or not.
6. Always return valid JSON without any additional formatting or code block markers (e.g., no \`\`\`json).
### Rules for Review:
${JSON.stringify(rules)}

### Key Instructions:
- Process each rule individually and systematically.
- For each violation, create a separate JSON object.
- If no violations are found in the provided code snippet, respond strictly with: { "status": "pass" }.
- Do not generate reviews for compliant code. Only violations should be reported.
- Ensure the JSON is valid and properly escaped.`;
async function loadCache() {
  try {
    const cacheData = await fs.promises.readFile(cachePath, "utf8");
    return JSON.parse(cacheData);
  } catch {
    return {};
  }
}

async function saveCache(cache) {
  await fs.promises.writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");
}

function sanitizeJsonString(rawString) {
  if (typeof rawString !== "string") return "";
  const match = rawString.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1].trim() : rawString.trim();
}

async function createAssistant(instructions) {
  const assistant = await openai.beta.assistants.create({
    name: "PR Review Assistant",
    instructions,
    model: "gpt-4o",
    temperature: 0.5,
    top_p: 1
  });
  console.log(`Assistant created with ID: ${assistant.id}`);
  return assistant.id;
}

async function createThread() {
  const thread = await openai.beta.threads.create();
  console.log(`Thread created with ID: ${thread.id}`);
  return thread.id;
}
async function cleanupOpenAiResources(assistantId, threadId) {
  await openai.beta.assistants.del(assistantId);
  await openai.beta.threads.del(threadId);
  console.log(`OpenAi Resources cleaned up.`);
}
async function getDiff() {
  return await fs.promises.readFile("pr_diff.txt", "utf8");
}

function parseDiff(diff, cache, prId) {
  return diff
    .split("diff --git")
    .slice(1)
    .map((change) => {
      const lines = change.trim().split("\n");
      const filePathMatch = lines[0]?.match(/b\/(\S+)/);
      const filePath = filePathMatch ? filePathMatch[1] : null;

      if (!filePath || filePath.includes("workflows/") || filePath.includes('rules/') || filePath.includes('scripts/')) return null;

      const addedLines = [];
      let lineCounter = null;
      lines.forEach((line) => {
        const hunkHeaderMatch = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkHeaderMatch) {
          lineCounter = parseInt(hunkHeaderMatch[1], 10);
        } else if (line.startsWith("+") && !line.startsWith("+++")) {
          const blameOutput = execSync(
            `git blame -L ${lineCounter},${lineCounter} --line-porcelain HEAD -- ${filePath}`
          ).toString().trim();

          const commitHash = blameOutput.split("\n")[0].split(" ")[0];
          if (cache[prId].reviewedCommits.includes(commitHash)) {
            lineCounter++;
            return;
          }
          addedLines.push({ lineNumber: lineCounter, lineDiff: line.slice(1), commitId: commitHash });
          lineCounter++;
        } else if (!line.startsWith("-")) {
          if (lineCounter !== null) lineCounter++;
        }
      });

      return addedLines.length ? { filePath, addedLines } : null;
    })
    .filter(Boolean);
}

async function sendChunksToThread(changes, threadId) {
  const filePaths = [];
  for (const { filePath, addedLines } of changes) {
    if (!addedLines.length) continue;

    let chunk = [];
    let currentTokenCount = 0;
    for (const line of addedLines) {
      const lineTokenEstimate = Math.ceil(
        (line.lineDiff.length || AVERAGE_LINE_CHARACTERS) / CHARACTERS_PER_TOKEN
      );

      if (currentTokenCount + lineTokenEstimate > MAX_TOKENS - RESERVED_TOKENS) {
        await openai.beta.threads.messages.create(threadId, {
          role: "user",
          content: `Review the following changes in the filePath ${filePath}:\n${JSON.stringify(chunk, null, 2)}`,
        });
        chunk = [];
        currentTokenCount = 0;
      }

      chunk.push(line);
      currentTokenCount += lineTokenEstimate;
    }

    if (chunk.length > 0) {
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: `Review the following changes in the filePath ${filePath}:\n${JSON.stringify(chunk, null, 2)}`,
      });
    }

    if (!filePaths.includes(filePath)) {
      filePaths.push(filePath);
    }
  }

  return filePaths;
}

async function createRun(threadId, assistantId, filePaths) {
    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: assistantId,
      additional_instructions: `make sure to review all user's changes in ${filePaths.join(", ")}. Try to find as much issues as possible. Make sure there will be no false positives`,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "code_review_response",
          schema: {
            type: "object",
            properties: {
              reviews: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    filePath: { type: "string" },
                    line: { type: "integer" },
                    issuesDescriptions: { type: "string" },
                    fix: { type: "string" }
                  },
                  required: ["filePath", "line", "issuesDescriptions", "fix"],
                  additionalProperties: false
                }
              }
            },
            required: ["reviews"],
            additionalProperties: false
          },
          strict: true
        }
      }    
    });
  return run;
}

async function retrieveFeedbacks(threadId) {
    const assistantMessages = await openai.beta.threads.messages.list(
      threadId,
      {
        order: "desc" // Ensure messages are retrieved in chronological order,
      }
    );
    // Sanitize and parse each assistant message
    return assistantMessages.data
    .filter((message) => message.role === "assistant")
    .flatMap((message) => {
      try {
        // Sanitize and parse each message content
        const sanitizedMessage = sanitizeJsonString(message.content[0].text.value);
        const parsedMessage = JSON.parse(sanitizedMessage); // Parse into JSON object
        
        // Check if the message contains the 'reviews' key and return it
        if (parsedMessage && parsedMessage.reviews) {
          return parsedMessage.reviews; // Return the reviews array
        } else {
          console.error("No 'reviews' key found in assistant message:", parsedMessage);
          return [];
        }
      } catch (error) {
        console.error("Error parsing assistant message content:", error.message);
        return []; // Return an empty array for invalid messages
      }
    })
    .filter(Boolean); // Remove null or empty arrays
    
}

function updateFeedbackLines(feedbacks) {
  return feedbacks.map((feedback) => {
    try {
      const blameOutput = execSync(
        `git blame -L ${feedback.line},${feedback.line} --line-porcelain HEAD -- ${feedback.filePath}`
      ).toString().trim();

      const commitHash = blameOutput.split("\n")[0].split(" ")[0];
      const originalLine = parseInt(blameOutput.split("\n")[0].split(" ")[1], 10);

      return { ...feedback, line: originalLine, commitId: commitHash };
    } catch {
      return feedback;
    }
  });
}

async function generateFeedback() {
  try {
    const diff = await getDiff();
    const prId = process.env.PR_NUMBER;
    const cache = await loadCache();
    
    if (!cache[prId]) cache[prId] = { reviewedCommits: [] };

    const assistantId = await createAssistant(assistantInstruction);
    const threadId = await createThread();

    const changes = parseDiff(diff, cache, prId);
    if (changes.length === 0) {
      console.log("No changes found.");
      process.exit(0);
    }

    const filePaths = await sendChunksToThread(changes, threadId);

    const run = await createRun(threadId, assistantId, filePaths);
    if (!run || run.status !== "completed") {
      console.error("Run failed.");
      process.exit(1);
    }

    const feedbacks = await retrieveFeedbacks(threadId);
    const updatedFeedbacks = updateFeedbackLines(feedbacks);

    await fs.promises.writeFile(
      "feedbacks.json",
      JSON.stringify(updatedFeedbacks, null, 2),
      "utf8"
    );

    const newCommits  = changes.flatMap((change) =>
      change.addedLines.map((line) => line.commitId).filter(Boolean)
    );
    
    cache[prId].reviewedCommits = [...new Set([...cache[prId].reviewedCommits, ...newCommits])];
    await saveCache(cache);
    await cleanupOpenAiResources(assistantId, threadId);
  } catch (error) {
    console.error("Error generating feedback:", error);
    process.exit(1);
  }
}

generateFeedback();
