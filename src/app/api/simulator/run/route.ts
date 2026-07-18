import { NextRequest } from 'next/server';
import { PR_TEMPLATES } from '@/lib/templates';
import { jsonError, parseJsonBody } from '@/lib/api/http';
import { MAX_BODY_BYTES, validateSimulatorRunRequest } from '@/lib/api/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const parsedBody = await parseJsonBody(req, MAX_BODY_BYTES);
  if (!parsedBody.ok) {
    const status = parsedBody.code === 'BODY_TOO_LARGE' ? 413 : 400;
    return jsonError(parsedBody.code, parsedBody.message, status);
  }

  const validation = validateSimulatorRunRequest(parsedBody.value);
  if (!validation.ok) {
    return jsonError('VALIDATION_ERROR', validation.message, 400);
  }

  const { templateId, memory = [] } = validation.value;
  const template = PR_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    return jsonError('UNKNOWN_TEMPLATE', 'Unknown template', 400);
  }

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
