<?php

use App\Http\Controllers\DatasetController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AnalisisController;
use App\Http\Controllers\AnomaliController;

Route::redirect('/', '/datasets');
Route::get('/datasets', [DatasetController::class, 'index'])->name('datasets.index');
Route::post('/datasets', [DatasetController::class, 'store'])->name('datasets.store');
Route::get('/datasets/{id}', [DatasetController::class, 'show'])->name('datasets.show');
Route::post('/datasets/{id}/clean', [DatasetController::class, 'clean'])->name('datasets.clean');

Route::get('/datasets/{id}/anomali', [AnomaliController::class, 'index'])->name('anomali.index');
Route::patch('/anomali/{anomali}', [AnomaliController::class, 'update'])->name('anomali.update');
Route::post('/datasets/{id}/terapkan-review', [AnomaliController::class, 'terapkan'])->name('anomali.terapkan');

Route::get('/datasets/{id}/analisis', [AnalisisController::class, 'index'])->name('analisis.index');
Route::post('/datasets/{id}/prediksi', [AnalisisController::class, 'prediksi'])->name('analisis.prediksi');
