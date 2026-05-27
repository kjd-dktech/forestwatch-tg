"use client";

import React from 'react';
import { LAND_COVER_CLASSES } from '@/lib/constants';

export default function Legend() {
  return (
    <div className="absolute bottom-6 right-6 z-10 bg-white/90 dark:bg-[#1a1a1a]/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 pointer-events-auto">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
        Occupation du Sol
      </h3>
      <div className="flex flex-col gap-2.5">
        {LAND_COVER_CLASSES.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded-sm shadow-sm" 
              style={{ backgroundColor: c.hex }} 
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
