// ─── Simulator API Route ──────────────────────────────────────────────────────
// POST /api/simulator/run
// Receives a template id + current memory, returns SSE stream of agent events.

import { NextRequest } from 'next/server';
import { PR_TEMPLATES } from '@/lib/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { templateId, memory = [] } = body;

  const template = PR_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return new Response(JSON.stringify({ error: 'Unknown template' }), { status: 400 });
  }

  // Import agent dynamically (server-only)
  const { runAgent } = await import('@/lib/agent/agent');

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: string, data: unknown) {
        const line = `data: ${JSON.stringify({ event, data })}\n\n`;
        controller.enqueue(encoder.encode(line));
      }

      try {
        emit('start', { template: { id: template.id, pr: template.pr, repo: template.repo } });

        await runAgent({
          template,
          memory,
          onStep(step) {
            emit('step', step);
          },
          onComplete(result) {
            emit('complete', result);
          },
          onNewMemory(entries) {
            emit('memory', entries);
          },
        });
      } catch (err) {
        emit('error', { message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
