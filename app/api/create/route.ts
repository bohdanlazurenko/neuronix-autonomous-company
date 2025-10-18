/**
 * API Route: /api/create
 * Creates a complete project from brief with Server-Sent Events streaming
 */

import { NextRequest } from 'next/server';
import { createOrchestrator } from '@/lib/orchestrator';
import { StatusUpdate, ProjectResult } from '@/agents/types';

// Disable body size limit for this route
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

/**
 * POST /api/create
 * Creates a new project from brief
 */
export async function POST(request: NextRequest) {
  console.log('[API] POST /api/create - Request received');

  try {
    // Parse request body
    const body = await request.json();
    const { brief } = body;

    // Validate brief
    if (!brief || typeof brief !== 'string' || brief.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Brief is required and must be a non-empty string' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[API] Brief received:', brief.substring(0, 100) + '...');

    // Create orchestrator
    const orchestrator = createOrchestrator();

    // Create readable stream for SSE
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Helper function to send SSE message
          const sendMessage = (data: any) => {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          };

          // Send initial message
          sendMessage({
            message: '🚀 Начинаю создание проекта...',
            status: 'idle',
            progress: 0,
          });

          // Create project with streaming updates
          let finalResult: ProjectResult | null = null;

          const statusCallback = (update: StatusUpdate) => {
            sendMessage({
              message: update.message,
              status: update.status,
              progress: update.progress,
              error: update.error,
            });
          };

          try {
            finalResult = await orchestrator.createProject(brief, statusCallback);

            // Send final result
            sendMessage({
              message: '✅ Проект успешно создан!',
              status: 'completed',
              progress: 100,
              result: {
                prd: finalResult.prd,
                plan: finalResult.plan,
                repoUrl: finalResult.repoUrl,
                deployUrl: finalResult.deployUrl,
                previewUrl: finalResult.previewUrl,
                deployTime: finalResult.deployTime,
                totalDuration: finalResult.totalDuration,
              },
            });
          } catch (error) {
            console.error('[API] Project creation error:', error);

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            sendMessage({
              message: `❌ Ошибка: ${errorMessage}`,
              status: 'error',
              progress: 0,
              error: errorMessage,
            });
          }

          // Close the stream
          controller.close();
        } catch (error) {
          console.error('[API] Stream error:', error);
          controller.error(error);
        }
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      },
    });
  } catch (error) {
    console.error('[API] Request processing error:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET /api/create
 * Health check endpoint
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      status: 'ok',
      message: 'Neuronix API is running',
      timestamp: new Date().toISOString(),
      endpoints: {
        create: 'POST /api/create - Create a project from brief',
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
