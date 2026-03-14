import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const JOB_ROLES = [
  'AE / 마케터',
  '콘텐츠 디렉터 / PD',
  '영상 에디터',
  '대표 / 임원',
  '프리랜서',
  '기타',
];

const COMPANY_TYPES = [
  '마케팅 에이전시',
  '브랜드 / 커머스',
  'MCN / 크리에이터',
  '프리랜서',
  '기타',
];

const CATEGORIES = [
  '식품 / F&B',
  '뷰티 / 패션',
  '테크 / 전자제품',
  '라이프스타일',
  '교육 / 정보',
  '기타',
];

const CHANNELS = [
  '인스타그램 광고',
  '쓰레드 / SNS',
  '지인 추천',
  '검색 (구글/네이버)',
  '마케팅 커뮤니티',
  '기타',
];

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [jobRole, setJobRole] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [channel, setChannel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function toggleCategory(cat: string) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);

    await supabase.from('user_profiles').upsert({
      user_id: user.id,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      job_role: jobRole || null,
      company_type: companyType || null,
      categories: categories.length > 0 ? categories : null,
      acquisition_channel: channel || null,
      onboarding_completed: true,
    }, { onConflict: 'user_id' });

    navigate('/app/analyze');
  }

  async function handleSkip() {
    if (!user) return;
    // Mark as visited but not completed
    await supabase.from('user_profiles').upsert({
      user_id: user.id,
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      onboarding_completed: false,
    }, { onConflict: 'user_id' });

    navigate('/app/analyze');
  }

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';

  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <FlaskConical className="w-5 h-5 text-gray-900" />
          <span className="font-semibold text-base text-gray-900">WakaLab</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            반갑습니다{displayName ? `, ${displayName}님` : ''}!
          </h1>
          <p className="text-sm text-gray-500 mb-8">맞춤 경험을 위해 간단히 알려주세요</p>

          <div className="space-y-8">
            {/* Job role */}
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-3">어떤 일을 하고 계세요?</legend>
              <div className="space-y-2">
                {JOB_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="job_role"
                      checked={jobRole === role}
                      onChange={() => setJobRole(role)}
                      className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                      {role}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Company type */}
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-3">회사 유형은?</legend>
              <div className="space-y-2">
                {COMPANY_TYPES.map((type) => (
                  <label key={type} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="company_type"
                      checked={companyType === type}
                      onChange={() => setCompanyType(type)}
                      className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                      {type}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Categories */}
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-3">
                주로 다루는 카테고리는? <span className="text-xs text-gray-400 font-normal">(복수 선택)</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      categories.includes(cat)
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={categories.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-600">{cat}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Acquisition channel */}
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-3">와카랩을 어떻게 알게 되셨나요?</legend>
              <div className="space-y-2">
                {CHANNELS.map((ch) => (
                  <label key={ch} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="channel"
                      checked={channel === ch}
                      onChange={() => setChannel(ch)}
                      className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                      {ch}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex items-center gap-3 mt-10">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {submitting ? '저장 중...' : '시작하기'}
            </button>
            <button
              onClick={handleSkip}
              className="px-6 py-3 text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium"
            >
              건너뛰기 →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
