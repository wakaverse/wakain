import type { RecipeJSON } from '../../../types/recipe';
import PositioningCard from '../PositioningCard';
import HookAnalysisCard from '../HookAnalysisCard';
import ProductClaimsCard from '../ProductClaimsCard';

interface Props {
  data: RecipeJSON;
}

export default function TabStructure({ data }: Props) {
  return (
    <div className="space-y-3">
      <PositioningCard data={data} />
      <HookAnalysisCard data={data} />
      <ProductClaimsCard data={data} />
    </div>
  );
}
