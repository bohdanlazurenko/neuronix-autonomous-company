# Testing Guide for Neuronix Autonomous IT Company

## Pre-Deployment Testing Checklist

### 1. Local Environment Testing

Before deploying to production, ALWAYS test locally:

```bash
# Start local development server
npm run dev

# Wait for server to start (10-15 seconds)
# Server should be available at http://localhost:3003
```

### 2. Local Functionality Test

Test the full workflow locally:

```bash
curl -s http://localhost:3003/api/create \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"brief":"Create a simple counter app with increment and decrement buttons. Use Next.js 14, TypeScript, Tailwind CSS."}' 2>&1
```

**Expected Results:**
- ✅ PRD generated
- ✅ Code generated (10-18 files, 300-700+ lines)
- ✅ GitHub repository created
- ✅ Vercel project created
- ✅ Deployment triggered (may show 404 initially due to timing)

**Verify locally:**
```bash
# Check GitHub repo was created
curl -s "https://api.github.com/repos/bohdanlazurenko/PROJECT_NAME" \
  -H "Authorization: token $GITHUB_TOKEN" | jq '.name, .created_at'

# Check Vercel project was created
curl -s "https://api.vercel.com/v9/projects/PROJECT_NAME" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '.id, .name'

# Check deployments
curl -s "https://api.vercel.com/v6/deployments?projectId=PROJECT_ID&limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '.deployments[0] | {state: .readyState, url}'
```

### 3. Deployment to Production

After confirming local tests pass:

```bash
# Commit changes
git add -A
git commit -m "Your descriptive commit message"
git push origin main

# Wait for Vercel auto-deployment (60-90 seconds)
# Or manually trigger deployment
```

### 4. Production Testing

Test on production after deployment:

```bash
# Check latest production deployment
curl -s "https://api.vercel.com/v6/deployments?projectId=prj_ntP0UUEETYqeqEm2MOJzZGHIRXhw&limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '.deployments[0] | {state: .readyState, commit: .meta.githubCommitSha}'

# Test production endpoint
curl -s https://itcompanysonnet.vercel.app/api/create \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"brief":"YOUR_TEST_PROJECT_BRIEF"}' 2>&1
```

## Known Issues & Workarounds

### Issue: "Deployment not found" (404)

**Cause:** Timing issue - deployment is created but not immediately queryable via API

**Workaround:** 
- Deployment still proceeds successfully
- Check deployment status after 10-20 seconds
- Verify via Vercel dashboard or API manually

**Fix in progress:** Add retry logic with exponential backoff

### Issue: Dev Agent generates incomplete files

**Cause:** Z.AI API sometimes returns truncated JSON

**Workaround:**
- Use more detailed briefs
- Brief should be 2-3 sentences minimum
- Include technology stack in brief

## Environment Variables

Required for all environments:

```bash
# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_USERNAME=bohdanlazurenko

# Vercel
VERCEL_TOKEN=w1DAy...
VERCEL_ORG_ID=team_...

# Z.AI (Anthropic-compatible)
ANTHROPIC_API_KEY=05ff3073...
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_DEFAULT_SONNET_MODEL=glm-4.6
```

## Success Criteria

### Local Testing ✅
- [ ] Server starts without errors
- [ ] API responds to requests
- [ ] PM Agent generates PRD
- [ ] Dev Agent generates files
- [ ] GitHub repo is created
- [ ] Vercel project is created
- [ ] Deployment is triggered

### Production Testing ✅
- [ ] Production deployment is READY
- [ ] Latest commit matches local main
- [ ] API endpoint responds
- [ ] Full workflow completes
- [ ] Generated projects are accessible

## Troubleshooting

### Server won't start
```bash
# Kill existing processes
pkill -f "next dev"

# Clear cache and restart
rm -rf .next
npm run dev
```

### API returns 500 errors
- Check environment variables are set
- Verify tokens are valid (not expired)
- Check Z.AI API quota/limits

### Deployment fails
- Verify GitHub App integration is installed
- Check Vercel project has correct repo link
- Ensure repoId is being fetched correctly

## Performance Benchmarks

**Expected Performance:**
- PM Agent: 5-10 seconds
- Dev Agent: 10-20 seconds
- GitHub upload: 20-40 seconds (for 10-15 files)
- Vercel deployment: 40-90 seconds (building)
- **Total: 75-150 seconds per project**

## Contact

For issues or questions:
- GitHub: https://github.com/bohdanlazurenko/neuronix-autonomous-company
- Production: https://itcompanysonnet.vercel.app
