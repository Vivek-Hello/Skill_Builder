"use client";

import type { BuildResult } from "@/lib/types";

// Skills a visitor built, kept in this browser only until we add accounts
export type SavedSkill = {
  id: string;
  createdAt: number;
  description: string;
  result: BuildResult;
};

const KEY = "skillforge:skills";
const MAX_SAVED = 30;

function read(): SavedSkill[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(list: SavedSkill[]) {
  // Drop the oldest entries if storage is full rather than failing the save
  for (let n = Math.min(list.length, MAX_SAVED); n > 0; n--) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, n)));
      return;
    } catch {
      // quota exceeded or storage blocked; try with fewer
    }
  }
}

export const listSkills = () => read().sort((a, b) => b.createdAt - a.createdAt);
export const getSkill = (id: string) => read().find((s) => s.id === id) ?? null;

export function saveSkill(entry: SavedSkill) {
  write([entry, ...read().filter((s) => s.id !== entry.id)]);
}

export function removeSkill(id: string) {
  write(read().filter((s) => s.id !== id));
}

export const newSkillId = () => crypto.randomUUID().slice(0, 8);
