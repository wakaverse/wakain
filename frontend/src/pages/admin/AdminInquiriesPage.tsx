import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Inquiry {
  id: string;
  interest_type: string;
  company_name: string;
  contact_name: string;
  email: string;
  job_title: string | null;
  phone: string | null;
  message: string;
  source: string;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: '신규', color: 'bg-red-50 text-red-700' },
  contacted: { label: '연락완료', color: 'bg-blue-50 text-blue-700' },
  converted: { label: '전환', color: 'bg-green-50 text-green-700' },
  closed: { label: '종료', color: 'bg-gray-100 text-gray-500' },
};

const INTEREST_LABELS: Record<string, string> = {
  pro: 'Pro',
  enterprise: 'Enterprise',
  api: 'API',
  partnership: '파트너십',
  other: '기타',
};

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Inquiry | null>(null);

  useEffect(() => {
    loadInquiries();
  }, []);

  async function loadInquiries() {
    setLoading(true);
    const { data } = await supabase
      .from('contact_inquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setInquiries(data ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('contact_inquiries').update({ status }).eq('id', id);
    setInquiries((prev) =>
      prev.map((inq) => (inq.id === id ? { ...inq, status } : inq)),
    );
    if (selected?.id === id) {
      setSelected((prev) => prev ? { ...prev, status } : null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">문의 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            총 {inquiries.length}건 · 신규 {inquiries.filter((i) => i.status === 'new').length}건
          </p>
        </div>
        <button
          onClick={loadInquiries}
          className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-2">
          {inquiries.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">문의가 없습니다</p>
          ) : (
            inquiries.map((inq) => {
              const st = STATUS_LABELS[inq.status] ?? STATUS_LABELS.new;
              return (
                <button
                  key={inq.id}
                  onClick={() => setSelected(inq)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    selected?.id === inq.id
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${st.color}`}>
                        {st.label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {INTEREST_LABELS[inq.interest_type] ?? inq.interest_type}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(inq.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{inq.company_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {inq.contact_name} · {inq.email}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">{inq.message}</p>
                </button>
              );
            })
          )}
        </div>

        {/* Detail */}
        <div className="lg:col-span-1">
          {selected ? (
            <div className="sticky top-20 rounded-xl border border-gray-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{formatDate(selected.created_at)}</span>
                <span className="text-xs text-gray-400">{selected.source}</span>
              </div>

              <div>
                <p className="text-xs text-gray-400">관심 서비스</p>
                <p className="text-sm font-medium text-gray-900">
                  {INTEREST_LABELS[selected.interest_type] ?? selected.interest_type}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400">회사명</p>
                <p className="text-sm text-gray-900">{selected.company_name}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-400">이름</p>
                  <p className="text-sm text-gray-900">{selected.contact_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">직함</p>
                  <p className="text-sm text-gray-900">{selected.job_title || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400">이메일</p>
                <a
                  href={`mailto:${selected.email}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {selected.email}
                </a>
              </div>

              {selected.phone && (
                <div>
                  <p className="text-xs text-gray-400">연락처</p>
                  <p className="text-sm text-gray-900">{selected.phone}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-gray-400">문의 내용</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mt-1">
                  {selected.message}
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-2">상태 변경</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(STATUS_LABELS).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => updateStatus(selected.id, key)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                        selected.status === key
                          ? color + ' ring-1 ring-current'
                          : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <p className="text-sm text-gray-400">문의를 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
