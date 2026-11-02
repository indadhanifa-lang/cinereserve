<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

#[Fillable([
    'name',
    'slug',
    'description',
    'address',
    'city',
    'province',
    'booking_mode',
    'phone',
    'email',
    'latitude',
    'longitude',
    'logo_url',
    'operating_hours',
    'primary_color',
    'secondary_color',
])]
class Branch extends Model
{
    /** draft = setup incomplete, active = bookable, suspended = disabled by the platform. */
    public const STATUSES = ['draft', 'active', 'suspended'];

    public const BOOKING_MODES = ['room', 'seat'];

    protected function casts(): array
    {
        return [
            'operating_hours' => 'array',
            'photos' => 'array',
        ];
    }

    /** Owners and staff who manage this establishment. */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot('role')->withTimestamps();
    }

    public function owners(): BelongsToMany
    {
        return $this->members()->wherePivot('role', 'owner');
    }

    public function screens(): HasMany
    {
        return $this->hasMany(Screen::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(Schedule::class);
    }

    /** Only active establishments are listed to customers or accept bookings. */
    public function scopeBookable(Builder $query): void
    {
        $query->where('status', 'active');
    }

    /** Mini cinemas take on-demand bookings (any movie, any open time) instead of schedules. */
    public function isMiniCinema(): bool
    {
        return $this->category === 'mini_cinema';
    }

    /**
     * Whether [$start, $end) fits inside one opening window: the start day's
     * hours, or the previous day's hours when those run past midnight.
     * Times are Manila wall-clock values.
     */
    public function isOpenBetween(Carbon $start, Carbon $end): bool
    {
        foreach ([$start->copy()->subDay(), $start->copy()] as $day) {
            $hours = ($this->operating_hours ?? [])[strtolower($day->format('D'))] ?? null;
            if (! $hours) {
                continue;
            }

            $open = $day->copy()->setTimeFromTimeString($hours['open']);
            $close = $day->copy()->setTimeFromTimeString($hours['close']);
            if ($close->lte($open)) {
                $close->addDay();
            }

            if ($start->gte($open) && $end->lte($close)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Required setup steps before an establishment goes live. Every active
     * room needs its price; seat mode adds a seat layout. Mini cinemas need a
     * movie catalog to book from, regular cinemas a schedule.
     *
     * @return array<string, bool>
     */
    public function setupChecklist(): array
    {
        $profileFields = ['name', 'description', 'address', 'city', 'phone', 'email', 'logo_url', 'category'];
        $activeScreens = $this->screens()->where('status', 'active');

        $checklist = [
            'profile' => collect($profileFields)->every(fn (string $field) => filled($this->{$field}))
                && ! empty($this->operating_hours),
            'booking_mode' => in_array($this->booking_mode, self::BOOKING_MODES, true),
            'rooms' => (clone $activeScreens)->exists()
                && (! $this->isMiniCinema() || ! (clone $activeScreens)->whereNull('rental_price')->exists()),
        ];

        if ($this->booking_mode === 'seat') {
            $checklist['seats'] = Seat::where('status', 'active')
                ->whereIn('screen_id', (clone $activeScreens)->select('id'))
                ->exists();
        }

        if ($this->isMiniCinema()) {
            $checklist['movies'] = Movie::where('branch_id', $this->id)->where('status', 'active')->exists();
        } else {
            $checklist['schedules'] = $this->schedules()->where('status', 'active')->exists();
        }

        return $checklist;
    }

    public function setupComplete(): bool
    {
        return ! in_array(false, $this->setupChecklist(), true);
    }

    /**
     * Publishes a draft as soon as its setup is complete — no approval step.
     * Promotion only: an active establishment stays live while the owner
     * edits it, and suspension is left to the platform admin.
     */
    public function syncStatus(): void
    {
        if ($this->status === 'draft' && $this->setupComplete()) {
            $this->status = 'active';
            $this->save();
        }
    }
}
