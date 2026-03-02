import { useTranslation } from 'react-i18next';
import { Mail, MessageSquare, Clock } from 'lucide-react';
import SEOHead from '../components/SEOHead';

export default function ContactPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <SEOHead page="contact" />
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-6 h-6 text-gray-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t('contact.title')}
        </h1>
        <p className="text-gray-500 text-sm mb-8">
          {t('contact.description')}
        </p>

        <div className="space-y-4 text-left">
          <a
            href="mailto:contact@crabs.ai"
            className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{t('contact.email')}</p>
              <p className="text-sm text-gray-500">contact@crabs.ai</p>
            </div>
          </a>

        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{t('contact.hours')}</span>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {t('contact.company')}
          </p>
        </div>
      </div>
    </div>
  );
}
