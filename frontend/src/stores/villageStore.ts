import { defineStore } from 'pinia';
import { DEFAULT_VILLAGES } from 'src/data/referenceData';
import type { Village } from 'src/stores/models';

export const useVillageStore = defineStore('villages', {
  state: () => {
    const storedData = localStorage.getItem('villages');

    let parsed: Village[] = [];

    if (storedData) {
      parsed = JSON.parse(storedData) as Village[];
    }

    if (parsed.length < DEFAULT_VILLAGES.length) {
      return {
        villages: DEFAULT_VILLAGES,
      };
    }

    return {
      villages: parsed,
    };
  },

  actions: {
    save() {
      localStorage.setItem('villages', JSON.stringify(this.villages));
    },

    addVillage(name: string, memberCount: number) {
      const newId = Date.now().toString();

      this.villages.push({
        id: newId,
        name,
        memberCount,
        fundBalance: 0,
      });
    },

    updateVillage(id: string, name: string, memberCount: number) {
      const village = this.villages.find((item: Village) => item.id === id);

      if (village) {
        village.name = name;
        village.memberCount = memberCount;
      }
    },

    deleteVillage(id: string) {
      this.villages = this.villages.filter((item: Village) => item.id !== id);
    },
  },
});
