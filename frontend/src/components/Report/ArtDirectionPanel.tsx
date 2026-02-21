interface ArtDirection {
  tone_and_manner?: string;
  heading_font?: string;
  body_font?: string;
  font_color_system?: string[];
  highlight_method?: string;
  brand_colors?: string[];
  background_style?: string;
  color_temperature?: string;
  graphic_style?: string;
  recurring_elements?: string[];
  text_position_pattern?: string;
  frame_composition_rule?: string;
  visual_consistency?: string;
  style_reference?: string;
}

interface Props {
  art: ArtDirection;
}

function ColorChips({ colors, label }: { colors: string[]; label: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 mb-1">{label}</dt>
      <dd className="flex gap-2 flex-wrap">
        {colors.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="w-6 h-6 rounded-md border border-gray-200 shadow-sm"
              style={{ backgroundColor: c }}
            />
            <span className="text-xs font-mono text-gray-600">{c}</span>
          </div>
        ))}
      </dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5">{value}</dd>
    </div>
  );
}

export default function ArtDirectionPanel({ art }: Props) {
  return (
    <div className="space-y-6">
      {/* 톤 & 매너 */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-5 border">
        <h4 className="text-sm font-bold text-gray-800 mb-2">🎨 톤 & 매너</h4>
        <p className="text-sm text-gray-700">{art.tone_and_manner || '정보 없음'}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 타이포그래피 */}
        <div className="bg-white rounded-xl p-5 border">
          <h4 className="text-sm font-bold text-gray-800 mb-3">📝 타이포그래피</h4>
          <dl className="space-y-3">
            <InfoRow label="헤딩 폰트" value={art.heading_font} />
            <InfoRow label="본문 폰트" value={art.body_font} />
            <InfoRow label="강조 방법" value={art.highlight_method} />
            <InfoRow label="텍스트 배치" value={art.text_position_pattern} />
          </dl>
        </div>

        {/* 컬러 */}
        <div className="bg-white rounded-xl p-5 border">
          <h4 className="text-sm font-bold text-gray-800 mb-3">🎨 컬러</h4>
          <dl className="space-y-3">
            {art.font_color_system && art.font_color_system.length > 0 && (
              <ColorChips colors={art.font_color_system} label="폰트 컬러" />
            )}
            {art.brand_colors && art.brand_colors.length > 0 && (
              <ColorChips colors={art.brand_colors} label="브랜드 컬러" />
            )}
            <InfoRow label="색온도" value={art.color_temperature} />
          </dl>
        </div>
      </div>

      {/* 비주얼 스타일 */}
      <div className="bg-white rounded-xl p-5 border">
        <h4 className="text-sm font-bold text-gray-800 mb-3">📐 비주얼 스타일</h4>
        <dl className="grid grid-cols-2 gap-4">
          <InfoRow label="그래픽 스타일" value={art.graphic_style} />
          <InfoRow label="배경 스타일" value={art.background_style} />
          <InfoRow label="구도 규칙" value={art.frame_composition_rule} />
          <InfoRow label="일관성" value={art.visual_consistency} />
          <InfoRow label="스타일 레퍼런스" value={art.style_reference} />
        </dl>
      </div>

      {/* 반복 요소 */}
      {art.recurring_elements && art.recurring_elements.length > 0 && (
        <div className="bg-white rounded-xl p-5 border">
          <h4 className="text-sm font-bold text-gray-800 mb-3">🔄 반복 요소</h4>
          <div className="flex flex-wrap gap-2">
            {art.recurring_elements.map((el, i) => (
              <span key={i} className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full">
                {el}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
