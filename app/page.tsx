'use client';

import { useState } from 'react';
import { Rocket, Github, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface StatusMessage {
  message: string;
  status: string;
  progress: number;
  error?: string;
  result?: any;
}

const EXAMPLE_BRIEFS = [
  'Habit tracker с дневным трекингом и статистикой',
  'Landing page для SaaS продукта с pricing секцией',
  'Todo list с приоритетами и категориями',
  'Simple blog с Markdown поддержкой',
];

export default function HomePage() {
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!brief.trim()) {
      setError('Пожалуйста, введите бриф проекта');
      return;
    }

    setLoading(true);
    setStatus([]);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ brief }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setStatus(prev => [...prev, data]);

              if (data.result) {
                setResult(data.result);
              }

              if (data.error) {
                setError(data.error);
              }
            } catch (e) {
              console.error('Failed to parse SSE message:', e);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setBrief(example);
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Rocket className="w-12 h-12 text-blue-500" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Neuronix
            </h1>
          </div>
          <p className="text-xl text-gray-400">
            Автономная ИТ компания на базе AI агентов
          </p>
          <p className="text-sm text-gray-500 mt-2">
            От брифа до GitHub репозитория и деплоя на Vercel за 2-4 минуты
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
            <label htmlFor="brief" className="block text-lg font-semibold mb-3">
              Опишите проект, который хотите создать:
            </label>
            <textarea
              id="brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Например: Создай habit tracker с дневным трекингом и статистикой"
              className="w-full h-32 px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={loading}
            />
            
            {/* Example buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-gray-500 mr-2">Примеры:</span>
              {EXAMPLE_BRIEFS.map((example, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  disabled={loading}
                  className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {example}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !brief.trim()}
              className="mt-6 w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Создаю проект...
                </>
              ) : (
                <>
                  <Rocket className="w-5 h-5" />
                  Создать проект
                </>
              )}
            </button>
          </div>
        </form>

        {/* Status Updates */}
        {status.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 shadow-xl mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              ) : error ? (
                <XCircle className="w-5 h-5 text-red-500" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              )}
              Прогресс создания проекта
            </h2>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {status.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded ${
                    msg.error
                      ? 'bg-red-900/20 border border-red-900'
                      : 'bg-gray-900/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm flex-1">{msg.message}</p>
                    {msg.progress > 0 && (
                      <span className="text-xs text-gray-500 ml-2">
                        {msg.progress}%
                      </span>
                    )}
                  </div>
                  
                  {msg.progress > 0 && (
                    <div className="mt-2 w-full bg-gray-700 rounded-full h-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${msg.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-gradient-to-br from-green-900/20 to-blue-900/20 border border-green-900/50 rounded-lg p-6 shadow-xl">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              🎉 Проект готов!
            </h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">Проект:</p>
                <p className="text-xl font-semibold">{result.plan?.project_name}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.repoUrl && (
                  <a
                    href={result.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Github className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-400">GitHub Repository</p>
                      <p className="text-sm font-mono truncate">
                        {result.repoUrl.replace('https://github.com/', '')}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                  </a>
                )}

                {result.deployUrl && (
                  <a
                    href={result.deployUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Rocket className="w-5 h-5 text-green-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-400">Live Demo (Vercel)</p>
                      <p className="text-sm font-mono truncate">
                        {result.deployUrl.replace('https://', '')}
                      </p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-500" />
                  </a>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-400 pt-4 border-t border-gray-700">
                <div>
                  <span className="text-gray-500">Время создания:</span>{' '}
                  <span className="font-mono">{result.totalDuration}s</span>
                </div>
                {result.deployTime && (
                  <div>
                    <span className="text-gray-500">Время деплоя:</span>{' '}
                    <span className="font-mono">{result.deployTime}s</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !result && (
          <div className="bg-red-900/20 border border-red-900 rounded-lg p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-red-500">
              <XCircle className="w-6 h-6" />
              Ошибка
            </h2>
            <p className="text-gray-300">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Powered by Claude Sonnet 4, MCP, Next.js 14, GitHub & Vercel</p>
          <p className="mt-1">Multi-agent system: PM Agent → Dev Agent → GitHub → Vercel</p>
        </div>
      </div>
    </main>
  );
}
