<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Movie;
use App\Models\Schedule;
use App\Models\Screen;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ScheduleController extends Controller
{
    private const SCHEDULE_FIELDS = [
        'id', 'movie_id', 'screen_id', 'show_date', 'start_time',
        'end_time', 'ticket_price', 'status',
    ];

    /**
     * Only the authenticated admin's own branch schedules are returned;
     * branch_id never comes from the client.
     */
    public function index(Request $request)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $schedules = Schedule::where('branch_id', $branchId)
            ->with('movie:id,title')
            ->with('screen:id,name')
            ->orderBy('show_date')
            ->orderBy('start_time')
            ->orderBy('id')
            ->get()
            ->map(fn (Schedule $schedule) => $schedule->only(self::SCHEDULE_FIELDS) + [
                'movie_title' => $schedule->movie?->title,
                'screen_name' => $schedule->screen?->name,
            ]);

        return response()->json(['schedules' => $schedules]);
    }

    /**
     * branch_id is always taken from the authenticated admin. The screen
     * must belong to that branch and must not overlap an existing
     * schedule on the same date.
     */
    public function store(Request $request)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $data = $request->validate($this->scheduleRules());

        $screenError = $this->screenBranchError($data['screen_id'], $branchId);
        if ($screenError instanceof JsonResponse) {
            return $screenError;
        }

        $movieError = $this->movieBranchError($data['movie_id'], $branchId);
        if ($movieError instanceof JsonResponse) {
            return $movieError;
        }

        $showDate = Carbon::parse($data['show_date'])->toDateString();

        $clashError = $this->clashError(
            $data['screen_id'],
            $showDate,
            $data['start_time'],
            $data['end_time']
        );
        if ($clashError instanceof JsonResponse) {
            return $clashError;
        }

        try {
            // Set explicitly: relying on the DB default leaves the in-memory
            // model (and so the API response) with status = null.
            $schedule = Schedule::create([
                'status' => 'active',
                'movie_id' => $data['movie_id'],
                'branch_id' => $branchId,
                'screen_id' => $data['screen_id'],
                'show_date' => $showDate,
                'start_time' => $data['start_time'],
                'end_time' => $data['end_time'],
                'ticket_price' => $data['ticket_price'],
            ]);
        } catch (QueryException) {
            return $this->duplicateError();
        }

        return $this->scheduleResponse($schedule, 201);
    }

    /**
     * Updates a schedule of the caller's branch only. Status becomes
     * editable here; creation still defaults to "active".
     */
    public function update(Request $request, int $id)
    {
        $branchId = $this->ownBranchId($request);
        if ($branchId instanceof JsonResponse) {
            return $branchId;
        }

        $schedule = Schedule::where('id', $id)
            ->where('branch_id', $branchId)
            ->first();
        if (! $schedule) {
            return response()->json(['message' => 'Schedule not found.'], 404);
        }

        $data = $request->validate($this->scheduleRules() + [
            'status' => ['required', 'string', 'in:'.implode(',', Schedule::STATUSES)],
        ]);

        $screenError = $this->screenBranchError($data['screen_id'], $branchId);
        if ($screenError instanceof JsonResponse) {
            return $screenError;
        }

        $movieError = $this->movieBranchError($data['movie_id'], $branchId);
        if ($movieError instanceof JsonResponse) {
            return $movieError;
        }

        $showDate = Carbon::parse($data['show_date'])->toDateString();

        $clashError = $this->clashError(
            $data['screen_id'],
            $showDate,
            $data['start_time'],
            $data['end_time'],
            $schedule->id
        );
        if ($clashError instanceof JsonResponse) {
            return $clashError;
        }

        try {
            $schedule->fill([
                'movie_id' => $data['movie_id'],
                'screen_id' => $data['screen_id'],
                'show_date' => $showDate,
                'start_time' => $data['start_time'],
                'end_time' => $data['end_time'],
                'ticket_price' => $data['ticket_price'],
                'status' => $data['status'],
            ]);
            $schedule->save();
        } catch (QueryException) {
            return $this->duplicateError();
        }

        return $this->scheduleResponse($schedule->fresh());
    }

    /**
     * Shared create/update payload rules. branch_id is never accepted.
     *
     * @return array<string, array<int, mixed>>
     */
    private function scheduleRules(): array
    {
        return [
            'movie_id' => ['required', 'integer', 'exists:movies,id'],
            'screen_id' => ['required', 'integer', 'exists:screens,id'],
            'show_date' => ['required', 'date'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'ticket_price' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * The selected screen must exist and belong to the caller's branch.
     *
     * @return JsonResponse|null
     */
    private function screenBranchError(int $screenId, int $branchId)
    {
        $screen = Screen::find($screenId);
        if (! $screen || (int) $screen->branch_id !== $branchId) {
            return response()->json([
                'message' => 'The selected screen does not belong to your branch.',
            ], 422);
        }

        return null;
    }

    /**
     * The selected movie must exist and belong to the caller's branch.
     *
     * @return JsonResponse|null
     */
    private function movieBranchError(int $movieId, int $branchId)
    {
        $movie = Movie::find($movieId);
        if (! $movie || (int) $movie->branch_id !== $branchId) {
            return response()->json([
                'message' => 'The selected movie does not belong to your branch.',
            ], 422);
        }

        return null;
    }

    /**
     * Rejects an exact duplicate (screen + date + start time) and any
     * time overlap on the same screen and date. Passing $exceptId skips
     * the schedule being edited so it never clashes with itself.
     *
     * @return JsonResponse|null
     */
    private function clashError(int $screenId, string $showDate, string $start, string $end, ?int $exceptId = null)
    {
        $clashes = Schedule::where('screen_id', $screenId)
            ->whereDate('show_date', $showDate)
            ->when($exceptId, fn ($query) => $query->where('id', '!=', $exceptId))
            ->get(self::SCHEDULE_FIELDS);

        foreach ($clashes as $clash) {
            $existingStart = substr((string) $clash->start_time, 0, 5);
            $existingEnd = substr((string) $clash->end_time, 0, 5);

            if ($existingStart === $start) {
                return $this->duplicateError();
            }

            // Strict inequality: a schedule starting exactly when another
            // ends (18:00-20:00 then 20:00-22:00) is allowed.
            if ($existingStart < $end && $existingEnd > $start) {
                return response()->json([
                    'message' => 'This schedule overlaps an existing schedule for this screen.',
                ], 422);
            }
        }

        return null;
    }

    private function duplicateError(): JsonResponse
    {
        return response()->json([
            'message' => 'A schedule already exists for this screen, date, and start time.',
        ], 422);
    }

    private function scheduleResponse(Schedule $schedule, int $status = 200): JsonResponse
    {
        $schedule->load('movie:id,title', 'screen:id,name');

        return response()->json([
            'schedule' => $schedule->only(self::SCHEDULE_FIELDS) + [
                'movie_title' => $schedule->movie?->title,
                'screen_name' => $schedule->screen?->name,
            ],
        ], $status);
    }

    /**
     * Branch ownership comes from the authenticated admin only; any
     * branch_id sent by the client is ignored.
     *
     * @return int|JsonResponse
     */
    private function ownBranchId(Request $request)
    {
        $branchId = $request->user()->branch_id;

        if (! $branchId) {
            return response()->json([
                'message' => 'No branch is assigned to your account.',
            ], 404);
        }

        return $branchId;
    }
}
