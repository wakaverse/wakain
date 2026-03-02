import { useTranslation } from 'react-i18next';
import { Radar, ScanLine, FileText, Layers, ArrowLeftRight, Lightbulb } from 'lucide-react';

const icons: Record<string, React.ElementType> = {
  radar: Radar, hack: ScanLine, script: FileText,
  expand: Layers, compare: ArrowLeftRight, insight: Lightbulb,
};

export default function ComingSoonPage({ menuKey }: { menuKey: string }) {
  const { t } = useTranslation();
  const Icon = icons[menuKey] || Lightbulb;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
        <Icon className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t(`menu.${menuKey}`)}</h1>
      <p className="text-gray-400 text-sm">Coming Soon</p>
      <p className="mt-2 text-gray-400 text-xs max-w-xs">
        {t(`features.${menuKey}.description`)}
      </p>
    </div>
  );
}
