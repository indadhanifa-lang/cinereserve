"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

/** Page search box seeded from `?q=` (set by the global search) and
 * re-synced whenever `q` changes; typing locally does not touch the URL. */
export function useUrlSearch() {
  const q = useSearchParams().get("q") ?? "";
  const [search, setSearch] = useState(q);
  const [prevQ, setPrevQ] = useState(q);

  if (q !== prevQ) {
    setPrevQ(q);
    setSearch(q);
  }

  return [search, setSearch] as const;
}
