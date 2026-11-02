<?php

use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AdminCustomerController;
use App\Http\Controllers\Api\AdminNotificationController;
use App\Http\Controllers\Api\AdminPaymentController;
use App\Http\Controllers\Api\AdminReservationController;
use App\Http\Controllers\Api\AdminSearchController;
use App\Http\Controllers\Api\AdminTicketController;
use App\Http\Controllers\Api\AiAnalyticsController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CustomerAssistantController;
use App\Http\Controllers\Api\CustomerAuthController;
use App\Http\Controllers\Api\CustomerBookingController;
use App\Http\Controllers\Api\CustomerBranchController;
use App\Http\Controllers\Api\CustomerHistoryController;
use App\Http\Controllers\Api\CustomerNotificationController;
use App\Http\Controllers\Api\CustomerPaymentController;
use App\Http\Controllers\Api\CustomerReservationController;
use App\Http\Controllers\Api\CustomerScheduleSeatController;
use App\Http\Controllers\Api\CustomerShowtimeController;
use App\Http\Controllers\Api\CustomerTicketController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\GenreController;
use App\Http\Controllers\Api\MovieController;
use App\Http\Controllers\Api\PlatformBranchController;
use App\Http\Controllers\Api\ScheduleController;
use App\Http\Controllers\Api\ScreenController;
use App\Http\Controllers\Api\SeatController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::post('/register', [CustomerAuthController::class, 'register'])->middleware('throttle:10,1');

Route::post('/customer/login', [CustomerAuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/customer/logout', [CustomerAuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/customer/me', [CustomerAuthController::class, 'me'])->middleware('auth:sanctum');
Route::patch('/customer/profile', [CustomerAuthController::class, 'updateProfile'])->middleware('auth:sanctum');
Route::post('/customer/avatar', [CustomerAuthController::class, 'updateAvatar'])->middleware('auth:sanctum');
Route::get('/customer/showtimes', [CustomerShowtimeController::class, 'index'])->middleware('auth:sanctum');
// Throttled per user to stay inside the Gemini free-tier quota.
Route::post('/customer/assistant', [CustomerAssistantController::class, 'chat'])->middleware(['auth:sanctum', 'throttle:20,1']);
Route::get('/customer/notifications', [CustomerNotificationController::class, 'index'])->middleware(['auth:sanctum', 'role:customer']);
Route::post('/customer/notifications/seen', [CustomerNotificationController::class, 'seen'])->middleware(['auth:sanctum', 'role:customer']);
Route::post('/customer/notifications/clear', [CustomerNotificationController::class, 'clear'])->middleware(['auth:sanctum', 'role:customer']);
Route::patch('/customer/notifications/{id}/read', [CustomerNotificationController::class, 'read'])->whereNumber('id')->middleware(['auth:sanctum', 'role:customer']);
Route::get('/customer/tickets', [CustomerTicketController::class, 'index'])->middleware('auth:sanctum');
Route::get('/customer/history', [CustomerHistoryController::class, 'index'])->middleware('auth:sanctum');
Route::get('/customer/schedules/{scheduleId}/seats', [CustomerScheduleSeatController::class, 'show'])->middleware('auth:sanctum');
Route::post('/customer/reservations', [CustomerReservationController::class, 'store'])->middleware('auth:sanctum');
Route::get('/customer/rooms/{screenId}/slot', [CustomerBookingController::class, 'slot'])->middleware('auth:sanctum');
Route::post('/customer/bookings', [CustomerBookingController::class, 'store'])->middleware('auth:sanctum');
Route::get('/customer/reservations/pending', [CustomerReservationController::class, 'pending'])->middleware('auth:sanctum');
Route::get('/customer/reservations/{reservationId}/payment', [CustomerPaymentController::class, 'show'])->middleware('auth:sanctum');
Route::post('/customer/reservations/{reservationId}/pay', [CustomerPaymentController::class, 'pay'])->middleware('auth:sanctum');

Route::get('/public/branches', [CustomerBranchController::class, 'index']);
Route::get('/public/branches/{id}', [CustomerBranchController::class, 'show']);

Route::post('/admin/register', [AdminAuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('/admin/login', [AdminAuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/admin/forgot-password', [AdminAuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/admin/reset-password', [AdminAuthController::class, 'resetPassword'])->middleware('throttle:5,1');

// Account endpoints shared by business owners and platform administrators.
Route::middleware(['auth:sanctum', 'role:admin,platform_admin'])->group(function () {
    Route::post('/admin/logout', [AdminAuthController::class, 'logout']);
    Route::get('/admin/me', [AdminAuthController::class, 'me']);
    Route::patch('/admin/profile', [AdminAuthController::class, 'updateProfile']);
    Route::post('/admin/profile/avatar', [AdminAuthController::class, 'updateAvatar']);
    Route::patch('/admin/password', [AdminAuthController::class, 'updatePassword'])->middleware('throttle:5,1');
});

// Business owner (partner) endpoints, scoped to the owner's current establishment.
Route::middleware(['auth:sanctum', 'role:admin'])->group(function () {
    Route::get('/admin/branches', [BranchController::class, 'index']);
    Route::post('/admin/branches', [BranchController::class, 'store']);
    Route::post('/admin/branches/{id}/select', [BranchController::class, 'select'])->whereNumber('id');
    Route::patch('/admin/branch', [BranchController::class, 'update']);
    Route::get('/admin/branch/setup', [BranchController::class, 'setup']);
    Route::post('/admin/branch/logo', [BranchController::class, 'updateLogo']);
    Route::post('/admin/branch/photos', [BranchController::class, 'storePhoto']);
    Route::delete('/admin/branch/photos', [BranchController::class, 'destroyPhoto']);
    Route::get('/admin/movies', [MovieController::class, 'index']);
    Route::post('/admin/movies', [MovieController::class, 'store']);
    Route::post('/admin/movies/{id}', [MovieController::class, 'update']);
    Route::patch('/admin/movies/{id}/status', [MovieController::class, 'updateStatus']);
    Route::get('/admin/genres', [GenreController::class, 'index']);
    Route::post('/admin/genres', [GenreController::class, 'store']);
    Route::get('/screens', [ScreenController::class, 'index']);
    Route::post('/screens', [ScreenController::class, 'store']);
    Route::patch('/screens/{id}', [ScreenController::class, 'update']);
    Route::post('/screens/{id}/photos', [ScreenController::class, 'storePhoto']);
    Route::delete('/screens/{id}/photos', [ScreenController::class, 'destroyPhoto']);
    Route::get('/screens/{screenId}/seats', [SeatController::class, 'index']);
    Route::post('/screens/{screenId}/seats', [SeatController::class, 'store']);
    Route::get('/schedules', [ScheduleController::class, 'index']);
    Route::post('/schedules', [ScheduleController::class, 'store']);
    Route::patch('/schedules/{id}', [ScheduleController::class, 'update']);
    Route::patch('/seats/{seatId}', [SeatController::class, 'update']);
    Route::get('/admin/dashboard/occupancy', [DashboardController::class, 'occupancy']);
    Route::get('/admin/dashboard/overview', [DashboardController::class, 'overview']);
    Route::get('/admin/reports', [DashboardController::class, 'reports']);
    Route::get('/admin/ai-analytics', [AiAnalyticsController::class, 'index']);
    Route::post('/admin/ai-analytics/insights', [AiAnalyticsController::class, 'insights'])->middleware('throttle:10,1');
    Route::get('/admin/search', [AdminSearchController::class, 'index']);
    // Static read-all before the dynamic {notificationId} route.
    Route::get('/admin/notifications', [AdminNotificationController::class, 'index']);
    Route::patch('/admin/notifications/read-all', [AdminNotificationController::class, 'readAll']);
    Route::patch('/admin/notifications/{notificationId}/read', [AdminNotificationController::class, 'read']);
    Route::get('/admin/reservations', [AdminReservationController::class, 'index']);
    Route::get('/admin/customers', [AdminCustomerController::class, 'index']);
    Route::get('/admin/payments', [AdminPaymentController::class, 'index']);
    Route::get('/admin/tickets', [AdminTicketController::class, 'index']);
    Route::post('/admin/tickets/check-in', [AdminTicketController::class, 'checkIn']);
});

Route::middleware(['auth:sanctum', 'role:platform_admin'])->group(function () {
    Route::get('/platform/branches', [PlatformBranchController::class, 'index']);
    Route::patch('/platform/branches/{id}/status', [PlatformBranchController::class, 'updateStatus'])->whereNumber('id');
});
