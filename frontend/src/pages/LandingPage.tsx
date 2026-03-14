import HeroSection from '../components/Landing/HeroSection';
import ProblemSection from '../components/Landing/ProblemSection';
import WorkflowSection from '../components/Landing/WorkflowSection';
import DemoSection from '../components/Landing/DemoSection';
import FeaturesSection from '../components/Landing/FeaturesSection';
import SocialProofSection from '../components/Landing/SocialProofSection';
import PricingSection from '../components/Landing/PricingSection';
import EnterpriseSection from '../components/Landing/EnterpriseSection';
import CTASection from '../components/Landing/CTASection';
import SEOHead from '../components/SEOHead';

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      <SEOHead page="landing" />
      <HeroSection />
      <ProblemSection />
      <WorkflowSection />
      <DemoSection />
      <FeaturesSection />
      <SocialProofSection />
      <PricingSection />
      <EnterpriseSection />
      <CTASection />
    </div>
  );
}
