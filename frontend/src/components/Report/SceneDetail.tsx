import { useState } from 'react';
import type { AppealScene, AppealPoint, Prescription, Stt } from '../../types';

/* ── Helpers ──────────────────────────────────────────── */

const APPEAL_TYPE_KO: Record<string, string> = {
  myth_bust: '오해반박', ingredient: '원재료/성분', manufacturing: '제조공정',
  track_record: '실적/수상', price: '가격/혜택', comparison: '비교우위',
  guarantee: '보장/환불', origin: '원산지', feature_demo: '기능시연',
  spec_data: '스펙수치', design_aesthetic: '디자인감성', authenticity: '진정성/리얼',
  social_proof: '사회적증거', urgency: '긴급/한정', lifestyle: '라이프스타일',
  nostalgia: '향수/추억', authority: '권위/전문가', emotional: '감정호소',
};

const strengthConfig: Record<string, { label: string; bg: string; text: string }> = {
  strong: { label: '강', bg: 'bg-green-100', text: 'text-green-700' },
  moderate: { label: '중', bg: 'bg-amber-100', text: 'text-amber-700' },
  weak: { label: '약', bg: 'bg-red-100', text: 'text-red-700' },
};

const severityIcon: Record<string, string> = {
  danger: '🔴',
  warning: '⚠️',
  info: '💡',
};

function getCutTranscript(cutTimeRange: [number, number], stt: Stt | null): string {
  if (!stt?.segments) return '';
  const [start, end] = cutTimeRange;
  const words: string[] = [];

  for (const seg of stt.segments) {
    if (seg.end <= start || seg.start >= end) continue;

    if (seg.words && seg.words.length > 0) {
      for (const w of seg.words) {
        if (w.end > start && w.start < end) words.push(w.word);
      }
    } else {
      const segDur = seg.end - seg.start;
      if (segDur <= 0) { words.push(seg.text); continue; }
      const overlapStart = Math.max(start, seg.start);
      const overlapEnd = Math.min(end, seg.end);
      const overlapRatio = (overlapEnd - overlapStart) / segDur;
      if (overlapRatio > 0.5) words.push(seg.text);
    }
  }
  return words.join(' ').trim();
}

/* ── Sub-sections ─────────────────────────────────────── */

function AppealRow({ appeal }: { appeal: AppealPoint }) {
  const str = strengthConfig[appeal.strength];
  const sourceIcon = appeal.source === 'script' ? '🎤' : appeal.source === 'visual' ? '🎬' : '🔗';

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="text-sm shrink-0">{sourceIcon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-gray-900">
            {APPEAL_TYPE_KO[appeal.type] || appeal.type}
          </span>
          {str && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${str.bg} ${str.text}`}>
              {str.label}
            </span>
          )}
          {appeal.visual_proof?.technique && appeal.visual_proof.technique !== 'none' && (
            <span className="text-[10px] text-gray-400">
              ({appeal.visual_proof.technique})
            </span>
          )}
        </div>
        <p className="text-xs text-gray-600 mt-0.5">{appeal.claim}</p>
      </div>
    </div>
  );
}

function RxCard({ rx, onSeek }: { rx: Prescription; onSeek: (t: number) => void }) {
  const icon = severityIcon[rx.severity] || '💡';
  const borderColor =
    rx.severity === 'danger' ? 'border-red-200 bg-red-50/50'
    : rx.severity === 'warning' ? 'border-amber-200 bg-amber-50/50'
    : 'border-blue-200 bg-blue-50/50';

  const handleTimeClick = () => {
    if (!rx.time_range) return;
    const match = rx.time_range.match(/([\d.]+)/);
    if (match) onSeek(parseFloat(match[1]));
  };

  return (
    <div className={`rounded-lg border p-3 ${borderColor}`}>
      <div className="flex items-start gap-2">
        <span className="text-sm">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-800">{rx.symptom}</p>
          <p className="text-xs text-gray-600 mt-1">→ {rx.recommendation}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500">
            {rx.impact && <span>{rx.impact}</span>}
            {rx.time_range && (
              <button
                onClick={(e) => { e.stopPropagation(); handleTimeClick(); }}
                className="text-blue-600 hover:underline"
              >
                ⏱ {rx.time_range}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────── */

interface Props {
  scene: AppealScene;
  prescriptions: Prescription[];
  stt: Stt | null;
  rhythmProfile: {
    cut_count: number;
    cut_density: number;
    zoom_events: number;
    color_shifts: number;
    tempo_level: string;
  } | null;
  onSeek: (time: number) => void;
  onClose: () => void;
}

export default function SceneDetail({ scene, prescriptions, stt, rhythmProfile, onSeek, onClose }: Props) {
  const [showCuts, setShowCuts] = useState(false);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5 mt-2 animate-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header + close */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-900">
          씬 {scene.scene_id} 상세
          <span className="text-gray-400 font-normal ml-2 font-mono text-xs">
            {scene.time_range[0].toFixed(1)}–{scene.time_range[1].toFixed(1)}s
          </span>
        </h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none px-1"
        >
          ✕
        </button>
      </div>

      {/* Script */}
      {(scene.stt_text || scene.caption_text) && (
        <section>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">스크립트</h5>
          {scene.stt_text && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 leading-relaxed">
              🎤 {scene.stt_text}
            </div>
          )}
          {scene.caption_text && scene.caption_text !== scene.stt_text && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-800 leading-relaxed mt-2">
              📝 {scene.caption_text}
            </div>
          )}
        </section>
      )}

      {/* Persuasion Intent */}
      {scene.persuasion_intent && (
        <section>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">설득 의도</h5>
          <p className="text-sm text-gray-700">{scene.persuasion_intent}</p>
        </section>
      )}

      {/* Appeals – grouped by source */}
      {scene.appeals.length > 0 && (() => {
        const visualAppeals = scene.appeals.filter(a => a.source === 'visual');
        const voiceAppeals = scene.appeals.filter(a => a.source === 'script' || a.source === 'both');
        return (
          <section>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              소구 포인트 ({scene.appeals.length})
            </h5>
            {visualAppeals.length > 0 && (
              <div className="mb-3">
                <h6 className="text-[11px] font-medium text-gray-400 mb-1">🎬 비주얼 소구</h6>
                <div className="divide-y divide-gray-100">
                  {visualAppeals.map((appeal, i) => (
                    <AppealRow key={`v-${i}`} appeal={appeal} />
                  ))}
                </div>
              </div>
            )}
            {voiceAppeals.length > 0 && (
              <div>
                <h6 className="text-[11px] font-medium text-gray-400 mb-1">🎤 보이스 소구</h6>
                <div className="divide-y divide-gray-100">
                  {voiceAppeals.map((appeal, i) => (
                    <AppealRow key={`s-${i}`} appeal={appeal} />
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })()}

      {/* Rhythm / Production Stats */}
      {rhythmProfile && (rhythmProfile.cut_count > 0 || rhythmProfile.cut_density > 0 || rhythmProfile.zoom_events > 0 || rhythmProfile.color_shifts > 0) && (
        <section>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">연출 수치</h5>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="컷" value={`${rhythmProfile.cut_count}개`} />
            <Stat label="컷 밀도" value={`${rhythmProfile.cut_density.toFixed(1)}/s`} />
            <Stat label="줌 이벤트" value={`${rhythmProfile.zoom_events}`} />
            <Stat
              label="템포"
              value={rhythmProfile.tempo_level === 'high' ? '빠름' : rhythmProfile.tempo_level === 'low' ? '느림' : '보통'}
              color={rhythmProfile.tempo_level === 'high' ? 'text-red-600' : rhythmProfile.tempo_level === 'low' ? 'text-blue-600' : 'text-amber-600'}
            />
          </div>
        </section>
      )}

      {/* Cuts breakdown (collapsible) */}
      {scene.cuts.length > 0 && (
        <section>
          <button
            onClick={() => setShowCuts(!showCuts)}
            className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1 hover:text-gray-700 transition-colors"
          >
            컷 상세 ({scene.cuts.length})
            <span className="text-[10px] normal-case">{showCuts ? '▲' : '▼'}</span>
          </button>
          {showCuts && (
            <div className="mt-2 space-y-1.5">
              {scene.cuts.map(cut => {
                const transcript = getCutTranscript(cut.time_range, stt);
                return (
                  <div
                    key={cut.cut_id}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => onSeek(cut.time_range[0])}
                  >
                    <span className="w-6 h-6 bg-gray-900 text-white rounded flex items-center justify-center text-[10px] font-bold shrink-0">
                      {cut.cut_id}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-gray-400 font-mono">
                        {cut.time_range[0].toFixed(1)}–{cut.time_range[1].toFixed(1)}s
                      </span>
                      {transcript && (
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                          &ldquo;{transcript}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Prescriptions for this scene */}
      {prescriptions.length > 0 && (
        <section>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            처방전 ({prescriptions.length})
          </h5>
          <div className="space-y-2">
            {prescriptions.map((rx, i) => (
              <RxCard key={i} rx={rx} onSeek={onSeek} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Tiny stat box ────────────────────────────────────── */

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
      <div className={`text-sm font-bold ${color || 'text-gray-900'}`}>{value}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
