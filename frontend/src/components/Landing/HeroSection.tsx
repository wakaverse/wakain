import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function HeroSection() {
  const { t } = useTranslation();

  const keywords = [
    { en: 'Spike', local: t('keywords.spike') },
    { en: 'Hack', local: t('keywords.hack') },
    { en: 'Recipe', local: t('keywords.recipe') },
    { en: 'Radar', local: t('keywords.radar') },
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-gradient-to-b from-gray-200/40 to-transparent blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
        >
          <span className="inline-block px-3 py-1 text-[11px] font-medium tracking-widest uppercase text-gray-400 border border-gray-200 rounded-full mb-8">
            {t('hero.badge')}
          </span>

          <h1 className="text-[2.5rem] sm:text-6xl lg:text-[4.5rem] font-bold tracking-tight text-gray-900 leading-[1.08]">
            {t('hero.title_line1')}
            <br />
            <span className="text-gray-300">{t('hero.title_line2')}</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            {t('hero.description')}
            <br className="hidden sm:block" />
            {t('hero.description2')}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-7 py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-all duration-300 hover:shadow-lg hover:shadow-gray-900/20 active:scale-[0.98]"
          >
            {t('hero.cta_start')}
            <ArrowRight className="w-4 h-4" />
          </Link>

        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6, ease }}
          className="mt-16 flex flex-wrap items-center justify-center gap-2"
        >
          {keywords.map((kw) => (
            <span
              key={kw.en}
              className="px-3 py-1.5 text-xs text-gray-400 bg-white border border-gray-100 rounded-full"
            >
              <span className="font-medium text-gray-500">{kw.en}</span>
              <span className="mx-1.5 text-gray-200">·</span>
              {kw.local}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
