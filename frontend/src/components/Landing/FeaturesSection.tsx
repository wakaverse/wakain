import { motion } from 'framer-motion';
import { Radar, Scan, FileText, Layers, ArrowLeftRight, Lightbulb, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const featureKeys = ['radar', 'hack', 'script', 'expand', 'compare', 'insight'] as const;
const featureIcons = [Radar, Scan, FileText, Layers, ArrowLeftRight, Lightbulb];
const comingSoonKeys = ['insight'];

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function FeaturesSection() {
  const { t } = useTranslation();

  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease }}
          className="text-center mb-16"
        >
          <span className="text-xs font-medium tracking-widest uppercase text-gray-400">
            {t('features.label')}
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {t('features.title')}
          </h2>
          <p className="mt-3 text-base text-gray-500 max-w-lg mx-auto">
            {t('features.description')}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureKeys.map((key, index) => {
            const Icon = featureIcons[index];
            const comingSoon = comingSoonKeys.includes(key);
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.5, delay: index * 0.08, ease }}
              >
                <div className={`group relative rounded-2xl border p-6 transition-all duration-300 hover:shadow-md ${
                  comingSoon ? 'border-dashed border-gray-200 bg-gray-50/50' : 'border-gray-100 bg-[#fafafa] hover:border-gray-200'
                }`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                      <Icon className={`w-5 h-5 ${comingSoon ? 'text-gray-300' : 'text-gray-900'}`} strokeWidth={1.5} />
                    </div>
                    {comingSoon ? (
                      <span className="px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase text-gray-400 bg-gray-100 rounded-full">
                        Coming Soon
                      </span>
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <h3 className={`text-base font-semibold tracking-tight ${comingSoon ? 'text-gray-400' : 'text-gray-900'}`}>
                      {t(`features.${key}.title`)}
                    </h3>
                  </div>
                  <p className={`text-sm leading-relaxed ${comingSoon ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t(`features.${key}.description`)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
