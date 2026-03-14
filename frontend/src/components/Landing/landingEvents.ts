import { supabase } from '../../lib/supabase';

export async function logActivity(
  action: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    await supabase.from('user_activity_logs').insert({
      user_id: userId,
      action,
      metadata,
    });
  } catch {
    // non-blocking
  }
}
