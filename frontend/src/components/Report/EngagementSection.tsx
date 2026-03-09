import { useState } from 'react';
import { Shield, AlertTriangle, Eye, MessageCircle, Share2, ChevronDown } from 'lucide-react';
import type { RecipeJSON } from '../../types/recipe';
import { formatTime, formatTimeRange, HOOK_STRENGTH_LABELS, RISK_LEVEL_LABELS } from '../../lib/recipe-utils';

interface Props {
  data: RecipeJSON;
  seekTo: (sec: number) => void;
}

export default function EngagementSection({ data, seekTo }: Props) {
  const { retention_analysis, dropoff_analysis } = data.engagement;

  return (
    <div className="space-y-3">
      {/* Hook strength */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-gray-900">훅 강도</span>
          <HookBadge strength={retention_analysis.hook_strength} />
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          {retention_analysis.hook_reason}
        </p>
      </div>

      {/* Triggers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TriggerCard
          icon={<Eye className="w-4 h-4 text-blue-600" />}
          title="재시청 트리거"
          triggers={retention_analysis.rewatch_triggers}
          seekTo={seekTo}
        />
        <TriggerCard
          icon={<Share2 className="w-4 h-4 text-green-600" />}
          title="공유 트리거"
          triggers={retention_analysis.share_triggers}
          seekTo={seekTo}
        />
        <TriggerCard
          icon={<MessageCircle className="w-4 h-4 text-purple-600" />}
          title="댓글 트리거"
          triggers={retention_analysis.comment_triggers}
          seekTo={seekTo}
        />
      </div>

      {/* Risk zones */}
      {dropoff_analysis.risk_zones.length > 0 && (
        <CollapsibleZone
          title={
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold">이탈 위험 구간</span>
              <span className="text-xs text-gray-400">({dropoff_analysis.risk_zones.length}개)</span>
            </div>
          }
        >
          <div className="space-y-2 pt-3">
            {dropoff_analysis.risk_zones.map((zone, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                onClick={() => seekTo(zone.time_range[0])}
              >
                <span className="font-mono text-gray-400 shrink-0">
                  {formatTimeRange(zone.time_range)}
                </span>
                <RiskBadge level={zone.risk_level} />
                <span className="text-gray-600">{zone.reason}</span>
              </div>
            ))}
          </div>
        </CollapsibleZone>
      )}

      {/* Safe zones */}
      {dropoff_analysis.safe_zones.length > 0 && (
        <CollapsibleZone
          title={
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold">안전 구간</span>
              <span className="text-xs text-gray-400">({dropoff_analysis.safe_zones.length}개)</span>
            </div>
          }
        >
          <div className="space-y-2 pt-3">
            {dropoff_analysis.safe_zones.map((zone, i) => (
              <div
                key={i}
                className="flex items-start gap-3 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                onClick={() => seekTo(zone.time_range[0])}
              >
                <span className="font-mono text-gray-400 shrink-0">
                  {formatTimeRange(zone.time_range)}
                </span>
                <span className="text-gray-600">{zone.reason}</span>
              </div>
            ))}
          </div>
        </CollapsibleZone>
      )}
    </div>
  );
}

function HookBadge({ strength }: { strength: string }) {
  const colors: Record<string, string> = {
    strong: 'bg-green-50 text-green-700',
    medium: 'bg-amber-50 text-amber-700',
    weak: 'bg-red-50 text-red-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[strength] || colors.medium}`}>
      {HOOK_STRENGTH_LABELS[strength] || strength}
    </span>
  );
}

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    high: 'bg-red-50 text-red-600',
    medium: 'bg-amber-50 text-amber-700',
    low: 'bg-yellow-50 text-yellow-700',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${colors[level] || colors.medium}`}>
      {RISK_LEVEL_LABELS[level] || level}
    </span>
  );
}

function TriggerCard({
  icon,
  title,
  triggers,
  seekTo,
}: {
  icon: React.ReactNode;
  title: string;
  triggers: { time: number; trigger: string }[];
  seekTo: (sec: number) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <span className="text-xs font-semibold">{title}</span>
        <span className="text-[10px] text-gray-400">{triggers.length}개</span>
      </div>
      <div className="space-y-2">
        {triggers.map((t, i) => (
          <div
            key={i}
            className="flex items-start gap-2 text-[11px] cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
            onClick={() => seekTo(t.time)}
          >
            <span className="font-mono text-gray-400 shrink-0">{formatTime(t.time)}</span>
            <span className="text-gray-600">{t.trigger}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CollapsibleZone({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between"
      >
        {title}
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && children}
    </div>
  );
}
