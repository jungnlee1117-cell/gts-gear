import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  categoriesToMap,
  DEFAULT_GEAR_CATEGORIES,
  mergeCategoriesWithDefaults,
} from "./gearCategoryData.js";
import { fetchGearCategories } from "./gearCategoryApi.js";

const GearCategoriesContext = createContext(null);

export function GearCategoriesProvider({ children }) {
  const [categories, setCategories] = useState(DEFAULT_GEAR_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await fetchGearCategories();
      setCategories(mergeCategoriesWithDefaults(rows));
    } catch (err) {
      console.warn("gear_categories load failed, using defaults", err);
      setCategories([...DEFAULT_GEAR_CATEGORIES]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const categoryMap = useMemo(() => categoriesToMap(categories), [categories]);
  const categoryKeys = useMemo(() => categories.map(c => c.id), [categories]);

  const value = useMemo(() => ({
    categories,
    categoryMap,
    categoryKeys,
    loading,
    refresh,
    setCategories,
  }), [categories, categoryMap, categoryKeys, loading, refresh]);

  return (
    <GearCategoriesContext.Provider value={value}>
      {children}
    </GearCategoriesContext.Provider>
  );
}

export function useGearCategories() {
  const ctx = useContext(GearCategoriesContext);
  if (!ctx) {
    return {
      categories: DEFAULT_GEAR_CATEGORIES,
      categoryMap: categoriesToMap(DEFAULT_GEAR_CATEGORIES),
      categoryKeys: DEFAULT_GEAR_CATEGORIES.map(c => c.id),
      loading: false,
      refresh: async () => {},
      setCategories: () => {},
    };
  }
  return ctx;
}
