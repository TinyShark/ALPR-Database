"use client";

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function withBasePath(path) {
  const basePath = typeof window !== 'undefined' ? window.__NEXT_DATA__?.basePath || '' : '';
  return `${basePath}${path}`;
}