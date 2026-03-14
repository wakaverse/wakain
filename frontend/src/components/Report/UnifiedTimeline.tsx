import { useState, useMemo } from 'react';
import type { RecipeJSON } from '../../types/recipe';
import { formatTime, BLOCK_LABELS, BLOCK_EVAL_COLORS, CLAIM_TYPE_INFO } from '../../lib/recipe-utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import TimelineDetail from './TimelineDetail';

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
  thumbnails: Record<string, string>;
  highlightRange?: [number, number] | null;
  onSceneClick?: (sceneId: number) => void;
}

/* ── Layer 1: 설득 흐름 컬러바 ──────────────── */

function PersuasionBar({ data, seekTo, duration, onBlockClick }: {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
  duration: number;
  onBlockClick: (idx: number) => void;
}) {
  const blocks = data.script.blocks;
  if (!blocks.length || duration <= 0) return null;

  return (
    <div>
      <div className="relative h-6 rounded-lg overflow-hidden">
        {blocks.map((block, i) => {
          const left = (block.time_range[0] / duration) * 100;
          const width = ((block.time_range[1] - block.time_range[0]) / duration) * 100;
          const color = BLOCK_EVAL_COLORS[block.block] || '#6B7280';
          return (
            <button
              key={i}
              className="absolute top-0 h-full cursor-pointer hover:brightness-110 transition-all group"
              style={{ left: `${left}%`, width: `${Math.max(width, 1)}%`, backgroundColor: color }}
              onClick={() => { seekTo(block.time_range[0]); onBlockClick(i); }}
              title={`${BLOCK_LABELS[block.block] || block.block} ${formatTime(block.time_range[0])}–${formatTime(block.time_range[1])}`}
            >
              {width > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/80 font-medium opacity-0 group-hover:opacity-100 transition-opacity truncate px-1">
                  {BLOCK_LABELS[block.block] || block.block}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Layer 2: 시각 변화량 곡선 ──────────────── */

function AttentionCurve({ data, duration, highlightRange }: { data: RecipeJSON; duration: number; highlightRange?: [number, number] | null }) {
  const rhythm = data.visual.rhythm;
  const { dropoff_analysis } = data.engagement;
  const blocks = data.script.blocks;

  const hasChart = rhythm?.attention_curve?.points?.length > 0;
  if (!hasChart) return null;

  const chartData = rhythm.attention_curve.points.map((p) => ({
    time: p.t,
    score: p.score,
  }));
  const avg = rhythm.attention_curve.avg ?? 0;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="utGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="time"
          tickFormatter={(v: number) => formatTime(v)}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          axisLine={{ stroke: '#e5e7eb' }}
          tickLine={false}
          domain={[0, duration]}
          type="number"
        />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />

        <Tooltip
          contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '11px' }}
          formatter={(value: unknown) => [`${value}`, '변화량']}
          labelFormatter={(label: unknown) => formatTime(Number(label))}
        />

        {/* Block color bands */}
        {blocks.map((block, i) => (
          <ReferenceArea
            key={`b-${i}`}
            x1={block.time_range[0]}
            x2={block.time_range[1]}
            fill={BLOCK_EVAL_COLORS[block.block] || '#6B7280'}
            fillOpacity={0.06}
          />
        ))}

        {/* Risk zones */}
        {dropoff_analysis?.risk_zones?.map((zone, i) => (
          <ReferenceArea
            key={`r-${i}`}
            x1={zone.time_range[0]}
            x2={zone.time_range[1]}
            fill={zone.risk_level === 'high' ? '#EF4444' : '#F59E0B'}
            fillOpacity={zone.risk_level === 'high' ? 0.12 : 0.08}
          />
        ))}

        {/* Highlight range from scene card click */}
        {highlightRange && (
          <ReferenceArea
            x1={highlightRange[0]}
            x2={highlightRange[1]}
            fill="#6366f1"
            fillOpacity={0.15}
          />
        )}

        {/* Average line */}
        <ReferenceLine
          y={avg}
          stroke="#d1d5db"
          strokeDasharray="4 4"
          label={{ value: `avg ${avg}`, position: 'right', fontSize: 9, fill: '#9ca3af' }}
        />

        {/* Attention curve */}
        <Area
          type="monotone"
          dataKey="score"
          stroke="#6366f1"
          fill="url(#utGrad)"
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Layer 2.5: 씬 썸네일 행 ─────────────────── */

function SceneThumbnails({ data, duration, seekTo, thumbnails, onSceneClick }: {
  data: RecipeJSON;
  duration: number;
  seekTo: (sec: number) => void;
  thumbnails: Record<string, string>;
  onSceneClick?: (sceneId: number) => void;
}) {
  const scenes = data.visual?.scenes || data.scenes;
  if (!scenes?.length || duration <= 0) return null;

  // Only show if we have at least one thumbnail
  const hasThumbnails = scenes.some((s) => thumbnails[String(s.scene_id)]);
  if (!hasThumbnails) return null;

  return (
    <div className="relative h-12">
      {scenes.map((scene) => {
        const left = (scene.time_range[0] / duration) * 100;
        const width = ((scene.time_range[1] - scene.time_range[0]) / duration) * 100;
        const thumb = thumbnails[String(scene.scene_id)];

        return (
          <button
            key={scene.scene_id}
            className="absolute top-0 h-full rounded overflow-hidden bg-gray-100 hover:ring-2 hover:ring-indigo-300 hover:ring-offset-1 transition-all"
            style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
            onClick={() => { seekTo(scene.time_range[0]); onSceneClick?.(scene.scene_id); }}
            title={`씬 ${scene.scene_id} ${formatTime(scene.time_range[0])}–${formatTime(scene.time_range[1])}`}
          >
            {thumb ? (
              <img src={thumb} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="flex items-center justify-center h-full text-[9px] text-gray-300 font-bold">
                {String(scene.scene_id).padStart(2, '0')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Layer 3: 블록 유형 라벨 ──────────────────── */

function ScriptBlocks({ data, duration, seekTo, onBlockClick, selectedBlock }: {
  data: RecipeJSON;
  duration: number;
  seekTo: (sec: number) => void;
  onBlockClick: (idx: number) => void;
  selectedBlock: number | null;
}) {
  const blocks = data.script.blocks;
  const claims = data.product?.claims || [];
  if (!blocks.length || duration <= 0) return null;

  return (
    <div className="relative h-auto min-h-[28px]">
      {blocks.map((block, i) => {
        const left = (block.time_range[0] / duration) * 100;
        const width = ((block.time_range[1] - block.time_range[0]) / duration) * 100;
        const color = BLOCK_EVAL_COLORS[block.block] || '#6B7280';
        const isSelected = selectedBlock === i;

        // 해당 블록에 겹치는 소구 → 가장 많은 유형명 표시
        const overlapping = claims.filter(
          (c) => c.time_range[0] < block.time_range[1] && c.time_range[1] > block.time_range[0],
        );
        let label: string;
        if (overlapping.length > 0) {
          const counts: Record<string, number> = {};
          for (const c of overlapping) {
            const info = CLAIM_TYPE_INFO[c.type];
            const typeName = info?.label || c.type;
            counts[typeName] = (counts[typeName] || 0) + 1;
          }
          label = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        } else {
          label = BLOCK_LABELS[block.block] || block.block;
        }

        return (
          <button
            key={i}
            className={`absolute top-0 px-1 py-1 text-[10px] leading-tight rounded cursor-pointer transition-all overflow-hidden flex items-center justify-center ${
              isSelected ? 'ring-2 ring-offset-1' : 'hover:bg-gray-100'
            }`}
            style={{
              left: `${left}%`,
              width: `${Math.max(width, 2)}%`,
              borderBottom: `2px solid ${color}`,
              color: color,
              '--tw-ring-color': color,
            } as React.CSSProperties}
            onClick={() => { seekTo(block.time_range[0]); onBlockClick(i); }}
            title={block.text}
          >
            <span className="font-medium truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Layer 4: 소구 태그 ──────────────────────── */

function ClaimTags({ data, duration, seekTo }: {
  data: RecipeJSON;
  duration: number;
  seekTo: (sec: number) => void;
}) {
  const claims = data.product?.claims;
  if (!claims?.length || duration <= 0) return null;

  return (
    <div className="relative h-7 bg-gray-50/50 rounded">
      {claims.map((claim, i) => {
        const left = (claim.time_range[0] / duration) * 100;
        const width = ((claim.time_range[1] - claim.time_range[0]) / duration) * 100;
        const info = CLAIM_TYPE_INFO[claim.type];
        return (
          <button
            key={i}
            className="absolute top-1 h-5 px-1.5 text-[9px] font-medium rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors truncate"
            style={{ left: `${left}%`, maxWidth: `${Math.max(width, 6)}%` }}
            onClick={() => seekTo(claim.time_range[0])}
            title={`${info?.label || claim.type}: ${claim.claim}`}
          >
            {info?.icon || '📌'} {info?.label || claim.type}
          </button>
        );
      })}
    </div>
  );
}

/* ── Main: UnifiedTimeline ───────────────────── */

export default function UnifiedTimeline({ data, seekTo, thumbnails, highlightRange, onSceneClick }: Props) {
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const duration = data.meta?.duration ?? 0;

  const handleBlockClick = (idx: number) => {
    setSelectedBlock((prev) => (prev === idx ? null : idx));
  };

  // Legend items
  const blockTypes = useMemo(
    () => [...new Set(data.script.blocks.map((b) => b.block))],
    [data.script.blocks],
  );
  const hasRiskZones = (data.engagement?.dropoff_analysis?.risk_zones?.length ?? 0) > 0;

  if (!data.script.blocks.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      {/* Time axis label */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">통합 타임라인</p>
        <span className="text-[10px] text-gray-400 font-mono">
          {formatTime(0)} — {formatTime(duration)}
        </span>
      </div>

      {/* Layer 1: Persuasion color bar */}
      <div className="mb-1">
        <PersuasionBar data={data} seekTo={seekTo} duration={duration} onBlockClick={handleBlockClick} />
      </div>

      {/* Layer 1.5: Scene thumbnails */}
      <div className="mb-1">
        <SceneThumbnails data={data} duration={duration} seekTo={seekTo} thumbnails={thumbnails} onSceneClick={onSceneClick} />
      </div>

      {/* Layer 2: Attention curve */}
      <div className="mb-1 -mx-1">
        <AttentionCurve data={data} duration={duration} highlightRange={highlightRange} />
      </div>

      {/* Layer 3: Script blocks */}
      <div className="mb-1">
        <ScriptBlocks
          data={data}
          duration={duration}
          seekTo={seekTo}
          onBlockClick={handleBlockClick}
          selectedBlock={selectedBlock}
        />
      </div>

      {/* Layer 4: Claim tags */}
      <div className="mb-2">
        <ClaimTags data={data} duration={duration} seekTo={seekTo} />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap border-t border-gray-50 pt-2">
        {blockTypes.map((type) => (
          <span key={type} className="flex items-center gap-1 text-[10px] text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: BLOCK_EVAL_COLORS[type] || '#6B7280' }} />
            {BLOCK_LABELS[type] || type}
          </span>
        ))}
        {hasRiskZones && (
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className="w-3 h-2 rounded-sm bg-red-100 border border-red-200" />
            이탈 위험
          </span>
        )}
      </div>

      {/* Detail panel (click to expand) */}
      {selectedBlock !== null && (
        <TimelineDetail
          blockIndex={selectedBlock}
          data={data}
          seekTo={seekTo}
          thumbnails={thumbnails}
          onClose={() => setSelectedBlock(null)}
        />
      )}
    </div>
  );
}
