-- 시간 겹침 기반 엔티티 조회 함수
-- recipe_json JSONB에서 시간 구간에 겹치는 모든 엔티티를 반환
CREATE OR REPLACE FUNCTION find_overlapping_entities(
  p_result_id UUID,
  p_start DOUBLE PRECISION,
  p_end DOUBLE PRECISION
) RETURNS JSONB AS $$
DECLARE
  recipe JSONB;
  result_obj JSONB := '{}';
  scenes_arr JSONB := '[]';
  blocks_arr JSONB := '[]';
  utterances_arr JSONB := '[]';
  risk_zones_arr JSONB := '[]';
  dynamics_sum DOUBLE PRECISION := 0;
  dynamics_count INTEGER := 0;
  elem JSONB;
  tr_start DOUBLE PRECISION;
  tr_end DOUBLE PRECISION;
  point_t DOUBLE PRECISION;
BEGIN
  SELECT recipe_json INTO recipe FROM results WHERE id = p_result_id;
  IF recipe IS NULL THEN RETURN result_obj; END IF;

  -- scenes
  FOR elem IN SELECT jsonb_array_elements(recipe->'visual'->'scenes')
  LOOP
    tr_start := (elem->'time_range'->0)::float;
    tr_end := (elem->'time_range'->1)::float;
    IF tr_start <= p_end AND tr_end >= p_start THEN
      scenes_arr := scenes_arr || elem;
    END IF;
  END LOOP;

  -- blocks
  FOR elem IN SELECT jsonb_array_elements(recipe->'script'->'blocks')
  LOOP
    tr_start := (elem->'time_range'->0)::float;
    tr_end := (elem->'time_range'->1)::float;
    IF tr_start <= p_end AND tr_end >= p_start THEN
      blocks_arr := blocks_arr || elem;
    END IF;
  END LOOP;

  -- utterances
  FOR elem IN SELECT jsonb_array_elements(recipe->'script'->'utterances')
  LOOP
    tr_start := (elem->>'start')::float;
    tr_end := (elem->>'end')::float;
    IF tr_start <= p_end AND tr_end >= p_start THEN
      utterances_arr := utterances_arr || elem;
    END IF;
  END LOOP;

  -- risk_zones
  FOR elem IN SELECT jsonb_array_elements(recipe->'engagement'->'dropoff_analysis'->'risk_zones')
  LOOP
    tr_start := (elem->'time_range'->0)::float;
    tr_end := (elem->'time_range'->1)::float;
    IF tr_start <= p_end AND tr_end >= p_start THEN
      risk_zones_arr := risk_zones_arr || elem;
    END IF;
  END LOOP;

  -- dynamics avg (attention_curve points in range)
  FOR elem IN SELECT jsonb_array_elements(recipe->'visual'->'rhythm'->'attention_curve'->'points')
  LOOP
    point_t := (elem->>'t')::float;
    IF point_t >= p_start AND point_t <= p_end THEN
      dynamics_sum := dynamics_sum + (elem->>'score')::float;
      dynamics_count := dynamics_count + 1;
    END IF;
  END LOOP;

  result_obj := jsonb_build_object(
    'scenes', scenes_arr,
    'blocks', blocks_arr,
    'utterances', utterances_arr,
    'risk_zones', risk_zones_arr,
    'dynamics_avg', CASE WHEN dynamics_count > 0 THEN round((dynamics_sum / dynamics_count)::numeric, 1) ELSE 0 END,
    'dynamics_count', dynamics_count
  );

  RETURN result_obj;
END;
$$ LANGUAGE plpgsql;
