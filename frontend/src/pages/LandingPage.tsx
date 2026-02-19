import { Link } from 'react-router-dom';
import { Target, TrendingUp, Video, ArrowRight, Zap } from 'lucide-react';

const features = [
  {
    icon: Target,
    title: '소구 레시피 해독',
    description: '영상의 설득 구조를 초 단위로 해체합니다',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: TrendingUp,
    title: '집중도 분석',
    description: '시청자가 어디서 이탈하는지 예측합니다',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    icon: Video,
    title: '제작 가이드',
    description: '분석 결과가 바로 제작 스펙이 됩니다',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
];

const stats = [
  { value: '29초', label: '평균 분석 영상 길이' },
  { value: '11종', label: '퍼포먼스 메트릭' },
  { value: '2분', label: '평균 분석 시간' },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/50 via-gray-950 to-gray-950" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            AI 숏폼 영상 분석 SaaS
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6 leading-tight">
            숏폼 영상, 왜 잘 되는지
            <br />
            <span className="text-blue-400">알려드립니다</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            AI가 영상을 해부해서 소구 전략, 집중도 커브, 제작 가이드를 추출합니다
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/analyze"
              className="flex items-center gap-2 px-8 py-3.5 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              무료로 분석해보기
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/results/demo-001"
              className="flex items-center gap-2 px-8 py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-lg transition-colors"
            >
              샘플 리포트 보기
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-800 bg-gray-900/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-3 gap-8">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <h2 className="text-2xl font-bold text-white text-center mb-12">
          영상 한 편, 모든 인사이트 한 번에
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {features.map(({ icon: Icon, title, description, color, bg }) => (
            <div
              key={title}
              className="p-6 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
            >
              <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-4`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">지금 바로 첫 영상을 분석해보세요</h2>
          <p className="text-blue-100 mb-6">무료 플랜으로 월 3건 분석 가능합니다</p>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
          >
            무료로 분석해보기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
