<?php

use Illuminate\Support\Facades\Route;

Route::get('/version', function () {
    return response()->json([
        'version' => config('app.version', '0.1.0'),
    ]);
});
