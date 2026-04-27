import React from 'react';
import { motion } from 'motion/react';

export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="relative w-12 h-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-full h-full border-2 border-stone-100 border-t-black rounded-full"
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 m-auto w-2 h-2 bg-black rounded-full"
        />
      </div>
      <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400 font-medium">L'Artiste Fleur</p>
    </div>
  );
}
