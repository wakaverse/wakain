import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function CTASection() {
  const { t } = useTranslation();

  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease }}
          className="relative rounded-3xl bg-gray-900 px-8 py-16 sm:px-16 sm:py-20 text-center overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800/50 to-transparent pointer-events-none" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.03] rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />

          <div className="relative">
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
              {t('cta.title_line1')}
              <br />
              {t('cta.title_line2')}
            </h2>

            <p className="mt-4 text-sm sm:text-base text-gray-400 max-w-md mx-auto leading-relaxed">
              {t('cta.description')}
              <br className="hidden sm:block" />
              {t('cta.description2')}
            </p>

            <Link
              to="/analyze"
              className="inline-flex items-center gap-2 mt-8 px-7 py-3 bg-white text-gray-900 text-sm font-medium rounded-full hover:bg-gray-100 transition-all duration-300 active:scale-[0.98]"
            >
              {t('cta.button')}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
