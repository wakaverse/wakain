import { useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import type { RecipeJSON } from '../../../types/recipe';
import CoachingCard from '../CoachingCard';

interface Props {
  data: RecipeJSON;
}

export default function TabCoaching({ data }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <CoachingCard data={data} />

      {/* 제작가이드 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate(`/app/guide/${id}`)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          제작가이드
        </button>
      </div>
    </div>
  );
}
