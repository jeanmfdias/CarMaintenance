<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'version' => config('app.version', '0.1.0'),
    ]);
});

Route::get('/ready', function () {
    try {
        $result = DB::select('SELECT 1 AS ok');
        if (empty($result) || ((array) $result[0])['ok'] != 1) {
            throw new \Exception('db check returned no row');
        }

        return response()->json([
            'status' => 'ok',
            'db' => 'ok',
            'version' => config('app.version', '0.1.0'),
        ]);
    } catch (\Throwable $e) {
        return response()->json([
            'status' => 'unavailable',
            'db' => 'error',
            'message' => $e->getMessage(),
        ], 503);
    }
});

Route::get('/version', function () {
    return response()->json([
        'version' => config('app.version', '0.1.0'),
    ]);
});
