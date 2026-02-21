interface Appeal {
  type: string;
  type_ko?: string;
  claim: string;
  technique?: string;
  technique_ko?: string;
  timestamp?: number;
  strength?: string;
}

interface SceneAnalysis {
  scene_index: number;
  time_range: string;
  role: string;
  attention: number;
  appeal_count: number;
  appeal_details?: Appeal[];
  duration: number;
}

interface Props {
  scenes: SceneAnalysis[];
  duration: number;
  onSeek: (time: number) => void;
  currentTime: number;
}

const roleColors: Record<string, string> = {
  hook: 'bg-red-400', demo: 'bg-blue-400', proof: 'bg-green-400',
  solution: 'bg-purple-400', cta: 'bg-orange-400', brand_intro: 'bg-yellow-400',
  recap: 'bg-teal-400', transition: 'bg-gray-300', body: 'bg-slate-400',
  problem: 'bg-pink-400',
};

const roleLabels: Record<string, string> = {
  hook: '훅', demo: '데모', proof: '증거', solution: '솔루션',
  cta: 'CTA', brand_intro: '브랜드', recap: '정리', transition: '전환',
  body: '본문', problem: '문제',
};

const appealIcons: Record<string, string> = {
  emotional: '❤️', feature_demo: '💡', ingredient: '🥬', spec_data: '📐',
  lifestyle: '🏠', origin: '🌍', price: '💰', social_proof: '📊',
  urgency: '⏰', guarantee: '🛡', myth_bust: '🪝', manufacturing: '🏭',
  comparison: '⚖️', nostalgia: '💭', authority: '👨‍⚕️', design_aesthetic: '🎨',
  sensory: '🎵', authenticity: '🤝', track_record: '🏆',
};

function parseTimeRange(tr: string): [number, number] {
  const match = tr.match(/([\d.]+)-([\d.]+)/);
  if (match) return [parseFloat(match[1]), parseFloat(match[2])];
  return [0, 0];
}

export default function AppealTimeline({ scenes, duration, onSeek, currentTime }: Props) {
  const allAppeals: (Appeal & { time: number; sceneRole: string })[] = [];
  scenes.forEach(s => {
    const [start] = parseTimeRange(s.time_range);
    (s.appeal_details || []).forEach(a => {
      allAppeals.push({ ...a, time: a.timestamp ?? start, sceneRole: s.role });
    });
  });

  return (
    <div className="space-y-4">
      {/* 타임라인 바 */}
      <div className="relative">
        <div className="text-xs text-gray-500 mb-1 flex justify-between">
          <span>0s</span>
          <span>{Math.round(duration / 2)}s</span>
          <span>{Math.round(duration)}s</span>
        </div>
        <div className="h-8 bg-gray-100 rounded-lg overflow-hidden flex relative">
          {scenes.map((s, i) => {
            const [start, end] = parseTimeRange(s.time_range);
            const width = ((end - start) / duration) * 100;
            const left = (start / duration) * 100;
            const isActive = currentTime >= start && currentTime < end;
            return (
              <div
                key={i}
                className={`absolute h-full cursor-pointer hover:opacity-80 transition-opacity ${roleColors[s.role] || 'bg-gray-300'} ${isActive ? 'ring-2 ring-blue-600 z-10' : ''}`}
                style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                onClick={() => onSeek(start)}
                title={`${roleLabels[s.role] || s.role} (${start.toFixed(1)}-${end.toFixed(1)}s)`}
              />
            );
          })}
          {/* 현재 재생 위치 */}
          <div
            className="absolute top-0 h-full w-0.5 bg-red-600 z-20"
            style={{ left: `${(currentTime / duration) * 100}%` }}
          />
        </div>
        {/* 역할 범례 */}
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(roleLabels).filter(([k]) => scenes.some(s => s.role === k)).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1 text-xs text-gray-600">
              <span className={`w-3 h-3 rounded ${roleColors[key]}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* 소구 포인트 목록 */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">소구 포인트 ({allAppeals.length}개)</h4>
        {allAppeals.length === 0 && <p className="text-sm text-gray-400">감지된 소구 포인트가 없습니다.</p>}
        {allAppeals.map((a, i) => {
          const isVisual = a.technique && !['text_overlay', 'none', ''].includes(a.technique);
          return (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => onSeek(a.time)}
            >
              <div className="text-lg">{appealIcons[a.type] || '📌'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">{a.time.toFixed(1)}s</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${isVisual ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isVisual ? '🎬 비주얼' : '📝 캡션'}
                  </span>
                  <span className="text-xs text-gray-400">{a.technique_ko || a.technique}</span>
                </div>
                <p className="text-sm text-gray-800 mt-0.5 truncate">{a.type_ko || a.type}: {a.claim}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
