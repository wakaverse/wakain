import { useState } from 'react';
import { Mail, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useScrollReveal } from '../../hooks/useScrollReveal';

const interestOptions = [
  { value: 'pro', label: 'WakaLab Pro' },
  { value: 'enterprise', label: 'Enterprise' },
  { value: 'api', label: 'API 연동' },
  { value: 'partnership', label: '파트너십' },
  { value: 'other', label: '기타' },
] as const;

export default function ContactSection() {
  const { ref, visible } = useScrollReveal();
  const [form, setForm] = useState({
    interest_type: '',
    company_name: '',
    contact_name: '',
    email: '',
    job_title: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  function update(field: string, value: string) {
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
    const { error: dbError } = await supabase.from('contact_inquiries').insert({
      ...form,
      job_title: form.job_title || null,
      phone: null,
      source: 'landing_inline',
    });
    setSubmitting(false);
    if (dbError) {
      setError('전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setSubmitted(true);
  }

  return (
    <section id="contact" className="py-20 sm:py-28 bg-gray-50">
      <div className="max-w-3xl mx-auto px-6" ref={ref}>
        <div
          className={`text-center mb-12 transition-all duration-700 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <span className="text-xs font-medium tracking-widest uppercase text-gray-400">
            Contact
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            문의하기
          </h2>
          <p className="mt-3 text-sm text-gray-500">
            도입, API 연동, 파트너십 등 궁금한 점이 있으시면 편하게 문의주세요.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-gray-400 mt-2">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> contact@crabs.ai</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 24시간 내 회신</span>
          </div>
        </div>

        <div
          className={`transition-all duration-700 delay-200 ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {submitted ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">문의가 접수되었습니다</h3>
              <p className="text-sm text-gray-500">24시간 내 회신드리겠습니다.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-5">
              {/* Interest type — inline pills */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  관심 서비스 <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {interestOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update('interest_type', opt.value)}
                      className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
                        form.interest_type === opt.value
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    회사명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => update('company_name', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
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
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">직함</label>
                  <input
                    type="text"
                    value={form.job_title}
                    onChange={(e) => update('job_title', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  문의 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => update('message', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {submitting ? '전송 중...' : '문의하기'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
