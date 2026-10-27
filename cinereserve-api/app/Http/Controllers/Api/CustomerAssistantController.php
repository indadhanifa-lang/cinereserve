<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class CustomerAssistantController extends Controller
{
    private const string CINEMA_TIMEZONE = 'Asia/Manila';

    /** Upcoming showtimes listed per movie in the prompt; keeps it small. */
    private const int SCHEDULES_PER_MOVIE = 8;

    /**
     * Customer help chat backed by Gemini. The client sends the running
     * conversation; the server adds the app facts and the live showtime feed
     * as the system instruction and returns one reply. The API key never
     * leaves the server, and nothing about the customer (name, email, phone,
     * tickets) is sent to Gemini — only public cinema data. Any Gemini
     * failure returns 503 so the app can fall back to its built-in FAQ.
     */
    public function chat(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'customer') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'messages' => ['required', 'array', 'min:1', 'max:20'],
            'messages.*.role' => ['required', 'string', 'in:user,assistant'],
            'messages.*.text' => ['required', 'string', 'max:1000'],
        ]);

        if (end($validated['messages'])['role'] !== 'user') {
            return response()->json(['message' => 'The last message must come from the customer.'], 422);
        }

        $key = config('services.gemini.key');

        if (! $key) {
            return $this->unavailable();
        }

        $model = config('services.gemini.model');

        try {
            $response = Http::withHeaders(['x-goog-api-key' => $key])
                ->timeout(25)
                ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", [
                    'systemInstruction' => ['parts' => [['text' => $this->systemPrompt($request)]]],
                    'contents' => array_map(fn (array $message) => [
                        'role' => $message['role'] === 'assistant' ? 'model' : 'user',
                        'parts' => [['text' => $message['text']]],
                    ], $validated['messages']),
                    'generationConfig' => [
                        'temperature' => 0.4,
                        'maxOutputTokens' => 1024,
                    ],
                ]);
        } catch (ConnectionException) {
            return $this->unavailable();
        }

        // Reply text = every non-"thought" part of the first candidate.
        $reply = trim(collect($response->json('candidates.0.content.parts', []))
            ->reject(fn ($part) => $part['thought'] ?? false)
            ->pluck('text')
            ->implode(''));

        if ($response->failed() || $reply === '') {
            Log::warning('Gemini help chat failed', ['status' => $response->status()]);

            return $this->unavailable();
        }

        return response()->json(['reply' => $reply]);
    }

    private function unavailable(): JsonResponse
    {
        return response()->json(['message' => 'The assistant is not available right now.'], 503);
    }

    /**
     * App rules plus the same feed the Movies tab shows, as compact text.
     * Reuses CustomerShowtimeController so the bot can never see a showtime
     * the customer couldn't book.
     */
    private function systemPrompt(Request $request): string
    {
        $feed = app(CustomerShowtimeController::class)->index($request)->getData(true);
        $today = Carbon::now(self::CINEMA_TIMEZONE)->format('l, F j, Y g:i A');

        $showing = collect($feed['movies'] ?? [])->map(function (array $movie) {
            $facts = implode('; ', array_filter([
                implode(', ', $movie['genres'] ?? []),
                $movie['age_rating'] ?? null,
                isset($movie['duration_minutes']) ? $movie['duration_minutes'].' min' : null,
            ]));
            $times = collect($movie['upcoming_schedules'] ?? [])
                ->take(self::SCHEDULES_PER_MOVIE)
                ->map(fn (array $s) => sprintf(
                    '%s %s at %s%s, PHP %s',
                    $s['show_date'],
                    substr((string) $s['start_time'], 0, 5),
                    $s['branch']['name'] ?? 'Cinema',
                    isset($s['screen']['name']) ? ' ('.$s['screen']['name'].')' : '',
                    $s['ticket_price'],
                ))
                ->implode('; ');

            return "- {$movie['title']} ({$facts}): {$times}";
        })->implode("\n") ?: '(none)';

        $comingSoon = collect($feed['coming_soon'] ?? [])
            ->map(fn (array $movie) => "- {$movie['title']}, opens ".substr((string) $movie['release_date'], 0, 10))
            ->implode("\n") ?: '(none)';

        return <<<PROMPT
        You are the help assistant inside CineReserve, a movie ticket booking app for cinemas in the Philippines.
        Now (cinema time, Asia/Manila): {$today}.

        How to answer:
        - Reply in the customer's language (English, Filipino/Tagalog or Cebuano/Bisaya).
        - Keep it short and friendly: at most 4 sentences or a short list. Plain text, no markdown headings.
        - Use only the facts and showtimes below. Never invent movies, times, prices, branches or policies.
        - If you don't know, say so and point to the right screen in the app or suggest contacting the branch.
        - Only help with movies, showtimes, bookings, payments, tickets and the app.

        App facts:
        - Book: Movies tab, tap a poster, View Showtimes, pick a time, choose seats, Continue, then pay.
        - Seats are held for 10 minutes; the Payment page shows a countdown. Unpaid holds are released.
        - Unpaid reservations appear under Pending Payment on Home while the hold is still running.
        - Payment methods: GCash or credit/debit card (Visa, Mastercard).
        - Paid tickets are in the Tickets tab; show the ticket code at the cinema entrance.
        - Bookings can't be cancelled or refunded in the app; the customer must contact the cinema branch.
        - Some seats cost more because they include a seat premium; the price shows when the seat is selected.
        - Profile > Personal Information changes the name, phone and photo.

        Showtimes customers can book now (date time at branch (screen), ticket price):
        {$showing}

        Coming soon:
        {$comingSoon}
        PROMPT;
    }
}
