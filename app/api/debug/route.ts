/**
 * Debug endpoint to check environment variables
 */

export async function GET() {
  return Response.json({
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    hasGitHubToken: !!process.env.GITHUB_TOKEN,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'not set',
    model: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'not set',
    username: process.env.GITHUB_USERNAME || 'not set',
  });
}
