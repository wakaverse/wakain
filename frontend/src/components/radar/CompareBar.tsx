import { useNavigate } from 'react-router-dom';
import type { RadarReel } from '../../types';

interface CompareBarProps {
  selectedReels: RadarReel[];
  onClear: () => void;
  onRemove: (reelId: string) => void;
}

export default function CompareBar({ selectedReels, onClear, onRemove }: CompareBarProps) {
  const navigate = useNavigate();

  if (selectedReels.length === 0) return null;

  const canCompare = selectedReels.length >= 2 && selectedReels.every((r) => r.is_analyzed && r.job_id);

  const handleCompare = () => {
    const jobIds = selectedReels.map((r) => r.job_id).filter(Boolean);
    if (jobIds.length >= 2) {
      navigate(`/app/compare?ids=${jobIds.join(',')}`);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-xs font-medium text-gray-700 shrink-0">
            선택됨 ({selectedReels.length}/3)
          </span>
          <div className="flex gap-2 overflow-x-auto">
            {selectedReels.map((reel) => (
              <div key={reel.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 shrink-0">
                {reel.thumbnail_url && (
                  <img src={reel.thumbnail_url} alt="" className="w-6 h-6 rounded object-cover" />
                )}
                <span className="text-[10px] text-gray-600 max-w-[100px] truncate">
                  {reel.caption?.slice(0, 30) || '영상'}
                </span>
                <button onClick={() => onRemove(reel.id)} className="text-gray-400 hover:text-gray-600 ml-0.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l6 6M9 3l-6 6" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3 shrink-0">
          <button
            onClick={handleCompare}
            disabled={!canCompare}
            className="text-xs font-medium px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            비교하기
          </button>
          <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600">
            취소
          </button>
        </div>
      </div>
    </div>
  );
}
