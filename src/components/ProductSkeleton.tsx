import React from 'react';
import { motion } from 'motion/react';

export default function ProductSkeleton() {
  return (
    <div className="w-full">
      <div className="relative aspect-[3/4] rounded-[32px] overflow-hidden mb-6 bg-stone-100 animate-pulse">
        <div className="absolute inset-0 bg-stone-200/50" />
      </div>
      <div className="space-y-3 px-2">
        <div className="h-3 bg-stone-200 rounded w-1/4 animate-pulse" />
        <div className="h-6 bg-stone-200 rounded w-3/4 animate-pulse" />
        <div className="h-5 bg-stone-200 rounded w-1/3 animate-pulse" />
        <div className="h-10 bg-stone-200 rounded-full w-full mt-4 animate-pulse" />
      </div>
    </div>
  );
}
