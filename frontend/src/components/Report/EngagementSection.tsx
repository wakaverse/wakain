import { useState } from 'react';
import { Shield, AlertTriangle, Eye, MessageCircle, Share2, ChevronDown, Timer, User, Package, Volume2, Scissors, Type, Zap } from 'lucide-react';
import type { RecipeJSON, HookElement } from '../../types/recipe';
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

      {/* Hook Scan — 3초/8초 2단 분해 */}
      {retention_analysis.hook_scan && (
        <HookScanCard scan={retention_analysis.hook_scan} />
      )}

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

function HookScanCard({ scan }: { scan: NonNullable<RecipeJSON['engagement']['retention_analysis']['hook_scan']> }) {
  const HOOK_TYPE_LABELS: Record<string, string> = {
    question: '질문형',
    shock: '충격형',
    curiosity: '호기심형',
    benefit: '혜택형',
    story: '스토리형',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="w-4 h-4 text-indigo-600" />
        <span className="text-sm font-semibold text-gray-900">후킹 구간 분석</span>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
          {HOOK_TYPE_LABELS[scan.hook_type] || scan.hook_type}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3">{scan.summary}</p>

      <div className="grid grid-cols-2 gap-3">
        <ElementColumn label="0 ~ 3초" element={scan.first_3s} accent="amber" />
        <ElementColumn label="0 ~ 8초" element={scan.first_8s} accent="blue" />
      </div>
    </div>
  );
}

function ElementColumn({ label, element, accent }: { label: string; element: HookElement; accent: 'amber' | 'blue' }) {
  const accentBg = accent === 'amber' ? 'bg-amber-50' : 'bg-blue-50';
  const accentText = accent === 'amber' ? 'text-amber-700' : 'text-blue-700';

  const badges: { icon: React.ReactNode; label: string; active: boolean }[] = [
    { icon: <User className="w-3 h-3" />, label: '인물', active: element.person_appear },
    { icon: <Package className="w-3 h-3" />, label: '제품', active: element.product_appear },
    { icon: <Type className="w-3 h-3" />, label: '텍스트', active: element.text_banner },
    { icon: <Volume2 className="w-3 h-3" />, label: '사운드', active: element.sound_change },
  ];

  return (
    <div className={`rounded-xl ${accentBg} p-3`}>
      <p className={`text-[11px] font-semibold ${accentText} mb-2`}>{label}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {badges.map((b) => (
          <span
            key={b.label}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
              b.active
                ? 'bg-white text-gray-800 shadow-sm'
                : 'bg-transparent text-gray-400'
            }`}
          >
            {b.icon}
            {b.label}
          </span>
        ))}
      </div>
      {element.appeal_type && (
        <p className="text-[10px] text-gray-500">
          소구: <span className="font-medium text-gray-700">{element.appeal_type}</span>
        </p>
      )}
      {element.cut_count > 0 && (
        <p className="text-[10px] text-gray-500 flex items-center gap-1">
          <Scissors className="w-3 h-3" /> 컷 전환 {element.cut_count}회
        </p>
      )}
      {element.text_banner_content && (
        <p className="text-[10px] text-gray-500 mt-1 truncate" title={element.text_banner_content}>
          배너: "{element.text_banner_content}"
        </p>
      )}
      <p className="text-[11px] text-gray-700 mt-1.5 font-medium flex items-center gap-1">
        <Zap className="w-3 h-3" /> {element.dominant_element}
      </p>
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
