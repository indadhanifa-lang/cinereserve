<?php

use App\Http\Controllers\Api\AdminAuthController;
use App\Http\Controllers\Api\AdminCustomerController;
use App\Http\Controllers\Api\AdminNotificationController;
use App\Http\Controllers\Api\AdminPaymentController;
use App\Http\Controllers\Api\AdminReservationController;
use App\Http\Controllers\Api\AdminSearchController;
use App\Http\Controllers\Api\AdminTicketController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CustomerAuthController;
use App\Http\Controllers\Api\CustomerHistoryController;
use App\Http\Controllers\Api\CustomerPaymentController;
use App\Http\Controllers\Api\CustomerReservationController;
use App\Http\Controllers\Api\CustomerScheduleSeatController;
use App\Http\Controllers\Api\CustomerShowtimeController;
use App\Http\Controllers\Api\CustomerTicketController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\GenreController;
use App\Http\Controllers\Api\MovieController;
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
Route::get('/customer/tickets', [CustomerTicketController::class, 'index'])->middleware('auth:sanctum');
Route::get('/customer/history', [CustomerHistoryController::class, 'index'])->middleware('auth:sanctum');
Route::get('/customer/schedules/{scheduleId}/seats', [CustomerScheduleSeatController::class, 'show'])->middleware('auth:sanctum');
Route::post('/customer/reservations', [CustomerReservationController::class, 'store'])->middleware('auth:sanctum');
Route::get('/customer/reservations/pending', [CustomerReservationController::class, 'pending'])->middleware('auth:sanctum');
Route::get('/customer/reservations/{reservationId}/payment', [CustomerPaymentController::class, 'show'])->middleware('auth:sanctum');
Route::post('/customer/reservations/{reservationId}/pay', [CustomerPaymentController::class, 'pay'])->middleware('auth:sanctum');

Route::post('/admin/login', [AdminAuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/admin/logout', [AdminAuthController::class, 'logout'])->middleware('auth:sanctum');
Route::get('/admin/me', [AdminAuthController::class, 'me'])->middleware('auth:sanctum');
Route::patch('/admin/profile', [AdminAuthController::class, 'updateProfile'])->middleware('auth:sanctum');
Route::post('/admin/profile/avatar', [AdminAuthController::class, 'updateAvatar'])->middleware('auth:sanctum');
Route::patch('/admin/password', [AdminAuthController::class, 'updatePassword'])->middleware(['auth:sanctum', 'throttle:5,1']);
Route::patch('/admin/branch', [BranchController::class, 'update'])->middleware('auth:sanctum');
Route::post('/admin/branch/logo', [BranchController::class, 'updateLogo'])->middleware('auth:sanctum');
Route::get('/admin/movies', [MovieController::class, 'index'])->middleware('auth:sanctum');
Route::post('/admin/movies', [MovieController::class, 'store'])->middleware('auth:sanctum');
Route::get('/admin/genres', [GenreController::class, 'index'])->middleware('auth:sanctum');
Route::post('/admin/genres', [GenreController::class, 'store'])->middleware('auth:sanctum');
Route::get('/screens', [ScreenController::class, 'index'])->middleware('auth:sanctum');
Route::post('/screens', [ScreenController::class, 'store'])->middleware('auth:sanctum');
Route::patch('/screens/{id}', [ScreenController::class, 'update'])->middleware('auth:sanctum');
Route::get('/screens/{screenId}/seats', [SeatController::class, 'index'])->middleware('auth:sanctum');
Route::post('/screens/{screenId}/seats', [SeatController::class, 'store'])->middleware('auth:sanctum');
Route::get('/schedules', [ScheduleController::class, 'index'])->middleware('auth:sanctum');
Route::post('/schedules', [ScheduleController::class, 'store'])->middleware('auth:sanctum');
Route::patch('/schedules/{id}', [ScheduleController::class, 'update'])->middleware('auth:sanctum');
Route::patch('/seats/{seatId}', [SeatController::class, 'update'])->middleware('auth:sanctum');
Route::get('/admin/dashboard/occupancy', [DashboardController::class, 'occupancy'])->middleware('auth:sanctum');
Route::get('/admin/dashboard/overview', [DashboardController::class, 'overview'])->middleware('auth:sanctum');
Route::get('/admin/search', [AdminSearchController::class, 'index'])->middleware('auth:sanctum');
// Static read-all before the dynamic {notificationId} route.
Route::get('/admin/notifications', [AdminNotificationController::class, 'index'])->middleware('auth:sanctum');
Route::patch('/admin/notifications/read-all', [AdminNotificationController::class, 'readAll'])->middleware('auth:sanctum');
Route::patch('/admin/notifications/{notificationId}/read', [AdminNotificationController::class, 'read'])->middleware('auth:sanctum');
Route::get('/admin/reservations', [AdminReservationController::class, 'index'])->middleware('auth:sanctum');
Route::get('/admin/customers', [AdminCustomerController::class, 'index'])->middleware('auth:sanctum');
Route::get('/admin/payments', [AdminPaymentController::class, 'index'])->middleware('auth:sanctum');
Route::get('/admin/tickets', [AdminTicketController::class, 'index'])->middleware('auth:sanctum');
