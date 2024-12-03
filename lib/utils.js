import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { useRouter } from 'next/router';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function useBasePath() {
  const router = useRouter();
  return router.basePath;
}

export function withBasePath(path) {
  const basePath = useBasePath();
  return `${basePath}${path}`;
}
