import { create } from "zustand";
import { type BotLayerKey } from "../../../api/analytics/endpoints";

export type BotCategoryFilter = "all" | "indexing" | "ai_answers" | "training";

type BotsStore = {
  selectedLayer: BotLayerKey | null;
  selectedCategory: BotCategoryFilter;
  setSelectedLayer: (layer: BotLayerKey | null) => void;
  setSelectedCategory: (category: BotCategoryFilter) => void;
};

export const useBotsStore = create<BotsStore>(set => ({
  selectedLayer: null,
  selectedCategory: "all",
  setSelectedLayer: layer => set({ selectedLayer: layer }),
  setSelectedCategory: category => set({ selectedCategory: category }),
}));
