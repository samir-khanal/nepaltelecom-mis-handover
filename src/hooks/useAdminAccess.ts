import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useAdminAccess() {
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setHasAdminAccess(false);
        setLoading(false);
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);

      const isAdmin = roles && roles.length > 0 && 
        ['super_admin', 'province_admin', 'district_user', 'imu_user'].includes(roles[0].role);
      
      setHasAdminAccess(isAdmin);
    } catch (error) {
      console.error("Error checking admin access:", error);
      setHasAdminAccess(false);
    } finally {
      setLoading(false);
    }
  };

  return { hasAdminAccess, loading };
}