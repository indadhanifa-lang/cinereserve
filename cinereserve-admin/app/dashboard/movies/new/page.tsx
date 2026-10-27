"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  AlertCircle,
  Clapperboard,
  Clock,
  Globe,
  Image as ImageIcon,
  Loader2,
  Plus,
  ShieldCheck,
  Tags,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type FormErrors = Partial<
  Record<
    | "title"
    | "description"
    | "duration_minutes"
    | "release_date"
    | "language"
    | "age_rating"
    | "status"
    | "genres"
    | "poster",
    string
  >
>;

const AGE_RATINGS = ["G", "PG", "PG-13", "R", "NC-17"];

export default function NewMoviePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [language, setLanguage] = useState("");
  const [ageRating, setAgeRating] = useState("");
  const [status, setStatus] = useState("active");
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genreModalOpen, setGenreModalOpen] = useState(false);
  const [newGenreName, setNewGenreName] = useState("");
  const [creatingGenre, setCreatingGenre] = useState(false);
  const [genreModalError, setGenreModalError] = useState<string | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (posterPreview) URL.revokeObjectURL(posterPreview);
    };
  }, [posterPreview]);

  useEffect(() => {
    fetch("/api/admin/genres")
      .then((res) => res.json())
      .then((data) => setGenres(data.genres ?? []))
      .catch(() => {});
  }, []);

  const handlePosterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (posterPreview) URL.revokeObjectURL(posterPreview);
    setPosterFile(file);
    setPosterPreview(URL.createObjectURL(file));
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  useEffect(() => {
    if (!genreModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGenreModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [genreModalOpen]);

  const handleCreateGenre = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newGenreName.trim();
    if (!name) return;

    setCreatingGenre(true);
    setGenreModalError(null);

    try {
      const res = await fetch("/api/admin/genres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setGenreModalError(data.errors?.name?.[0] ?? data.message ?? "Could not add genre.");
        return;
      }

      setGenres((prev) => [...prev, data.genre].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedGenres((prev) => [...prev, data.genre.name]);
      setNewGenreName("");
      setGenreModalOpen(false);
      toast.success(`"${data.genre.name}" added.`);
    } catch {
      setGenreModalError("Unable to reach the server. Try again.");
    } finally {
      setCreatingGenre(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setErrors({});

    try {
      const body = new FormData();
      body.append("title", title);
      if (description) body.append("description", description);
      body.append("duration_minutes", durationMinutes);
      if (releaseDate) body.append("release_date", releaseDate);
      if (language) body.append("language", language);
      if (ageRating) body.append("age_rating", ageRating);
      body.append("status", status);
      if (selectedGenres.length > 0) body.append("genres", selectedGenres.join(", "));
      if (posterFile) body.append("poster", posterFile);

      const res = await fetch("/api/admin/movies", { method: "POST", body });
      const data = await res.json().catch(() => ({}));

      if (res.status === 422) {
        const fieldErrors: FormErrors = {};
        for (const key of [
          "title",
          "description",
          "duration_minutes",
          "release_date",
          "language",
          "age_rating",
          "status",
          "genres",
          "poster",
        ] as const) {
          if (data.errors?.[key]?.[0]) fieldErrors[key] = data.errors[key][0];
        }
        setErrors(fieldErrors);
        setFormError("Check the highlighted fields and try again.");
      } else if (!res.ok) {
        setFormError(data.message ?? "Something went wrong. Try again.");
      } else {
        toast.success("Movie added to the catalog.");
        router.push("/dashboard/movies");
      }
    } catch {
      setFormError("Unable to reach the server. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full">
      {formError && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle />
          <AlertTitle>Could not add movie</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          {/* Left column: poster + status/rating */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            <div className="flex flex-col gap-4 rounded-2xl border border-border/30 bg-card p-5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Poster</h2>
                </div>
                <span className="text-xs font-semibold tracking-wider text-primary uppercase">
                  2:3
                </span>
              </div>

              <button
                type="button"
                onClick={() => posterInputRef.current?.click()}
                className="group relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted"
                aria-label="Choose poster image"
              >
                {posterPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={posterPreview}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition-opacity group-hover:opacity-40"
                  />
                ) : null}
                <div
                  className={cn(
                    "absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center transition-opacity",
                    posterPreview
                      ? "bg-black/50 opacity-0 group-hover:opacity-100"
                      : "text-muted-foreground"
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-card/90 text-primary shadow-sm">
                    <Upload className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-semibold text-foreground">
                    {posterPreview ? "Replace poster" : "Upload poster"}
                  </p>
                  {!posterPreview && (
                    <p className="text-xs text-muted-foreground">JPG, PNG, or WebP · up to 8MB</p>
                  )}
                </div>
              </button>
              <input
                ref={posterInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePosterChange}
              />
              {errors.poster && (
                <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.poster}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-border/30 bg-card p-5 shadow-md">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Status & Rating</h2>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Catalog Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["active", "inactive"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatus(value)}
                      className={cn(
                        "h-10 rounded-lg text-sm font-semibold capitalize transition-all",
                        status === value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Age Rating</Label>
                <div className="flex flex-wrap gap-1.5">
                  {AGE_RATINGS.map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setAgeRating(rating)}
                      className={cn(
                        "flex-1 rounded-lg py-2 text-sm font-bold transition-all",
                        ageRating === rating
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
                {errors.age_rating && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.age_rating}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right column: title, runtime, genres */}
          <div className="flex flex-col gap-6 lg:col-span-8">
            <div className="flex flex-col gap-4 rounded-2xl border border-border/30 bg-card p-5 shadow-md">
              <div className="flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Title & Synopsis</h2>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="movie-title">Title</Label>
                <Input
                  id="movie-title"
                  className="h-12 text-base font-medium"
                  placeholder="Enter full movie title…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  aria-invalid={Boolean(errors.title)}
                />
                {errors.title && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.title}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="movie-description">Description</Label>
                  <span className="text-xs text-muted-foreground">
                    {description.length} characters
                  </span>
                </div>
                <textarea
                  id="movie-description"
                  rows={4}
                  placeholder="Optional. What's this movie about?"
                  className="scrollbar-hide flex w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  aria-invalid={Boolean(errors.description)}
                />
                {errors.description && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-border/30 bg-card p-5 shadow-md">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Runtime & Release</h2>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="movie-duration">Duration (mins)</Label>
                  <Input
                    id="movie-duration"
                    type="number"
                    min={1}
                    className="h-11 font-semibold"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    aria-invalid={Boolean(errors.duration_minutes)}
                  />
                  {errors.duration_minutes && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.duration_minutes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="movie-release-date">Release Date</Label>
                  <Input
                    id="movie-release-date"
                    type="date"
                    className="h-11"
                    value={releaseDate}
                    onChange={(e) => setReleaseDate(e.target.value)}
                    aria-invalid={Boolean(errors.release_date)}
                  />
                  {errors.release_date && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.release_date}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="movie-language">Language</Label>
                  <div className="relative flex items-center">
                    <Globe className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="movie-language"
                      placeholder="Optional"
                      className="h-11 pl-10"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      aria-invalid={Boolean(errors.language)}
                    />
                  </div>
                  {errors.language && (
                    <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errors.language}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-border/30 bg-card p-5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tags className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Genres</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setGenreModalError(null);
                    setNewGenreName("");
                    setGenreModalOpen(true);
                  }}
                  aria-label="Add new genre"
                  title="Add new genre"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {genres.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No genres available yet.</p>
                ) : (
                  genres.map((genre) => {
                    const active = selectedGenres.includes(genre.name);
                    return (
                      <button
                        key={genre.id}
                        type="button"
                        onClick={() => toggleGenre(genre.name)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-sm font-semibold transition-all",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {genre.name}
                      </button>
                    );
                  })
                )}
              </div>
              {errors.genres && (
                <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.genres}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button type="submit" disabled={saving} className="h-11 gap-2 rounded-full px-6">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding…
              </>
            ) : (
              "Add Movie"
            )}
          </Button>
          <Link
            href="/dashboard/movies"
            className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Cancel
          </Link>
        </div>
      </form>

      {genreModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setGenreModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-genre-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-border/30 bg-card p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="new-genre-title" className="text-base font-semibold text-foreground">
                Add New Genre
              </h2>
              <button
                type="button"
                onClick={() => setGenreModalOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGenre} noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-genre-name">Genre Name</Label>
                <Input
                  id="new-genre-name"
                  autoFocus
                  className="h-11"
                  value={newGenreName}
                  onChange={(e) => setNewGenreName(e.target.value)}
                  aria-invalid={Boolean(genreModalError)}
                />
                {genreModalError && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {genreModalError}
                  </p>
                )}
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setGenreModalOpen(false)}
                  className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={creatingGenre || !newGenreName.trim()}
                  className="h-10 gap-2 rounded-full px-4"
                >
                  {creatingGenre ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    "Add Genre"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
