package com.roo.linkmonitor

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.room.Room

class ForecastWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val db = Room.databaseBuilder(applicationContext, RooDatabase::class.java, "roo.db").build()
        // The deployment wires saved routes to the HTTPS client; no saved route is a safe no-op.
        db.close()
        return Result.success()
    }
}
