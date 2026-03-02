import HeroSection from '../components/Landing/HeroSection';
import WorkflowSection from '../components/Landing/WorkflowSection';
import FeaturesSection from '../components/Landing/FeaturesSection';
import CTASection from '../components/Landing/CTASection';
import SEOHead from '../components/SEOHead';

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <SEOHead page="landing" />
      <HeroSection />
      <WorkflowSection />
      <FeaturesSection />
      <CTASection />
    </div>
  );
}
