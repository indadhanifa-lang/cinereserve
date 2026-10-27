"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { MovieForm, type EditableMovie } from "@/components/dashboard/movie-form";

export default function EditMoviePage() {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<EditableMovie | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ponytail: reuses the branch list endpoint; add GET /admin/movies/{id} if catalogs grow large.
  useEffect(() => {
    fetch("/api/admin/movies")
      .then((res) => res.json())
      .then((data) => {
        const found = (data.movies ?? []).find((m: EditableMovie) => String(m.id) === id);
        if (found) setMovie(found);
        else setError("Movie not found.");
      })
      .catch(() => setError("Unable to load movie. Try again."));
  }, [id]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!movie) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading movie…</span>
      </div>
    );
  }

  return <MovieForm movie={movie} />;
}
