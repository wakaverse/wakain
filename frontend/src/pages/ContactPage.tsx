import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Clock, Building2, Code2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import SEOHead from '../components/SEOHead';

const interestOptions = [
  { value: 'pro', label: 'WakaLab Pro (개인/팀)' },
  { value: 'enterprise', label: 'Enterprise (기업 도입)' },
  { value: 'api', label: 'API 연동' },
  { value: 'partnership', label: '파트너십 / 제휴' },
  { value: 'other', label: '기타' },
] as const;

interface FormData {
  interest_type: string;
  company_name: string;
  contact_name: string;
  email: string;
  job_title: string;
  phone: string;
  message: string;
}

export default function ContactPage() {
  const [searchParams] = useSearchParams();
  const typeParam = searchParams.get('type') || '';
  const sourceParam = searchParams.get('source') || 'nav';

  const [form, setForm] = useState<FormData>({
    interest_type: interestOptions.some((o) => o.value === typeParam) ? typeParam : '',
    company_name: '',
    contact_name: '',
    email: '',
    job_title: '',
    phone: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.interest_type || !form.company_name || !form.contact_name || !form.email || !form.message) {
      setError('필수 항목을 모두 입력해주세요.');
      return;
    }
    setSubmitting(true);
    setError('');

    const { error: dbError } = await supabase.from('contact_inquiries').insert({
      interest_type: form.interest_type,
      company_name: form.company_name,
      contact_name: form.contact_name,
      email: form.email,
      job_title: form.job_title || null,
      phone: form.phone || null,
      message: form.message,
      source: typeParam ? `landing_${typeParam}` : sourceParam,
    });

    setSubmitting(false);
    if (dbError) {
      setError('문의 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
        <SEOHead page="contact" />
        <div className="max-w-md w-full text-center">
          <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">문의가 접수되었습니다</h1>
          <p className="text-gray-500 text-sm">
            24시간 내 회신드리겠습니다.
            <br />
            감사합니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] py-16 px-4">
      <SEOHead page="contact" />
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
          {/* Left: Info */}
          <div className="lg:col-span-2">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">문의하기</h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-10">
              WakaLab 도입이나 API 연동에 대해
              <br />
              궁금한 점이 있으시면 편하게 문의주세요.
            </p>

            <div className="space-y-6">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">직접 연락</p>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href="mailto:contact@crabs.ai" className="hover:text-gray-900 transition-colors">
                    contact@crabs.ai
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500 mt-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>평일 10:00-18:00 (KST) · 24시간 내 회신</span>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">빠른 안내</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <Building2 className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Enterprise</p>
                      <p className="text-xs text-gray-400 mt-0.5">팀 규모/도입 일정에 맞춰 안내드립니다</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <Code2 className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">API</p>
                      <p className="text-xs text-gray-400 mt-0.5">기술 문서와 샌드박스 제공 가능합니다</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Interest type */}
              <fieldset>
                <legend className="text-sm font-medium text-gray-700 mb-3">
                  관심 서비스 <span className="text-red-500">*</span>
                </legend>
                <div className="space-y-2">
                  {interestOptions.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name="interest_type"
                        value={opt.value}
                        checked={form.interest_type === opt.value}
                        onChange={() => update('interest_type', opt.value)}
                        className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* Text fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    회사명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => update('company_name', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => update('contact_name', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">직함</label>
                  <input
                    type="text"
                    value={form.job_title}
                    onChange={(e) => update('job_title', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">연락처</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  문의 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={5}
                  value={form.message}
                  onChange={(e) => update('message', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '전송 중...' : '문의하기'}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            (주)크랩스 | 대표 김태영 | 사업자등록번호 224-88-02602
          </p>
        </div>
      </div>
    </div>
  );
}
