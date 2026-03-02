import { motion } from 'framer-motion';
import { TrendingUp, Scan, FileText, Maximize2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const stepKeys = ['spike', 'hack', 'script', 'expand'] as const;
const stepIcons = [TrendingUp, Scan, FileText, Maximize2];

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function WorkflowSection() {
  const { t } = useTranslation();

  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease }}
          className="text-center mb-16"
        >
          <span className="text-xs font-medium tracking-widest uppercase text-gray-400">
            {t('workflow.label')}
          </span>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            {t('workflow.title')}
          </h2>
        </motion.div>

        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
          <div className="hidden lg:block absolute top-12 left-[12.5%] right-[12.5%] h-px bg-gray-200" />

          {stepKeys.map((key, index) => {
            const Icon = stepIcons[index];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: index * 0.1, ease }}
                className="relative text-center"
              >
                <div className="relative z-10 mx-auto w-24 h-24 rounded-2xl bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center mb-5 transition-shadow duration-300 hover:shadow-md">
                  <Icon className="w-6 h-6 text-gray-900 mb-1" strokeWidth={1.5} />
                  <span className="text-[10px] font-mono text-gray-300">{String(index + 1).padStart(2, '0')}</span>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 tracking-tight">
                  {t(`workflow.steps.${key}.title`)}
                </h3>
                <p className="text-sm font-medium text-gray-400 mt-0.5">
                  {t(`workflow.steps.${key}.subtitle`)}
                </p>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed max-w-[200px] mx-auto">
                  {t(`workflow.steps.${key}.description`)}
                </p>

                {index < stepKeys.length - 1 && (
                  <div className="hidden lg:block absolute top-12 -right-2 translate-x-1/2 z-20">
                    <svg width="8" height="12" viewBox="0 0 8 12" fill="none" className="text-gray-300">
                      <path d="M1.5 1L6.5 6L1.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
